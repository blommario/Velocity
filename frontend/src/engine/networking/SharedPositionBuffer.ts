/**
 * SharedArrayBuffer helpers for zero-copy position data transfer
 * between the main thread and the network Web Worker.
 *
 * Outbound SAB (24 bytes): local player position → worker → server
 *   [0-3]   generation (Uint32, Atomics) — main thread bumps after write
 *   [4-23]  position data (20 bytes, same layout as PositionCodec encode)
 *
 * Inbound SAB (904 bytes): server → worker → remote player positions
 *   [0-3]   generation (Uint32, Atomics) — worker bumps after write
 *   [4-7]   playerCount (Uint32)
 *   [8...]  32 player slots × 28 bytes each:
 *     [0-3]   slot (Uint32)
 *     [4-7]   posX (Float32)
 *     [8-11]  posY (Float32)
 *     [12-15] posZ (Float32)
 *     [16-19] yaw (Float32, decoded from Int16)
 *     [20-23] pitch (Float32, decoded from Int16)
 *     [24-27] timestamp (Uint32, ms since match start)
 *
 * Depends on: NetworkConstants
 * Used by: WebTransportTransport, transport.worker, pollInboundPositions
 */

import { TRANSPORT_CONFIG } from './NetworkConstants';

// ── Outbound (main thread writes, worker reads) ──

const OUTBOUND_GEN_OFFSET = 0;
const OUTBOUND_DATA_OFFSET = 4;
const OUTBOUND_DATA_SIZE = 20;

/** Creates a SharedArrayBuffer for outbound position data (local player → server). */
export function createOutboundBuffer(): SharedArrayBuffer {
  return new SharedArrayBuffer(TRANSPORT_CONFIG.OUTBOUND_BUFFER_SIZE);
}

/**
 * Writes a 20-byte encoded position into the outbound SAB.
 * Called from the main thread (physics tick) at up to 128Hz.
 * The worker polls this at 20Hz to send to the server.
 */
export function writeOutboundPosition(sab: SharedArrayBuffer, encodeBuffer: ArrayBuffer): void {
  const src = new Uint8Array(encodeBuffer, 0, OUTBOUND_DATA_SIZE);
  const dst = new Uint8Array(sab, OUTBOUND_DATA_OFFSET, OUTBOUND_DATA_SIZE);

  // Copy position data (non-atomic — 20 bytes is small enough for coherent reads on x86/ARM)
  dst.set(src);

  // Bump generation counter atomically to signal new data
  const gen = new Int32Array(sab, OUTBOUND_GEN_OFFSET, 1);
  Atomics.add(gen, 0, 1);
}

/**
 * Reads the latest position data from the outbound SAB.
 * Called from the worker at 20Hz. Returns null if no new data since last read.
 */
export function readOutboundPosition(
  sab: SharedArrayBuffer,
  lastGen: number,
): { data: Uint8Array; generation: number } | null {
  const gen = new Int32Array(sab, OUTBOUND_GEN_OFFSET, 1);
  const currentGen = Atomics.load(gen, 0);

  if (currentGen === lastGen) return null;

  return {
    data: new Uint8Array(sab, OUTBOUND_DATA_OFFSET, OUTBOUND_DATA_SIZE),
    generation: currentGen,
  };
}

// ── Inbound (worker writes, main thread reads) ──

const INBOUND_GEN_OFFSET = 0;
const INBOUND_COUNT_OFFSET = 4;
const INBOUND_SLOTS_OFFSET = TRANSPORT_CONFIG.INBOUND_HEADER_SIZE;
const PLAYER_SIZE = TRANSPORT_CONFIG.INBOUND_PLAYER_SIZE;

/** Creates a SharedArrayBuffer for inbound position data (server → remote players). */
export function createInboundBuffer(): SharedArrayBuffer {
  return new SharedArrayBuffer(TRANSPORT_CONFIG.INBOUND_BUFFER_SIZE);
}

/** Decoded inbound player data for writing into SAB. */
export interface InboundPlayerData {
  slot: number;
  posX: number;
  posY: number;
  posZ: number;
  yaw: number;
  pitch: number;
  timestamp: number;
}

/**
 * Writes a decoded position batch into the inbound SAB.
 * Called from the worker when a position batch arrives from the server.
 */
export function writeInboundBatch(
  sab: SharedArrayBuffer,
  players: readonly InboundPlayerData[],
  count: number,
): void {
  const view = new DataView(sab);

  // Write player data
  for (let i = 0; i < count; i++) {
    const p = players[i];
    const offset = INBOUND_SLOTS_OFFSET + i * PLAYER_SIZE;

    view.setUint32(offset, p.slot, true);
    view.setFloat32(offset + 4, p.posX, true);
    view.setFloat32(offset + 8, p.posY, true);
    view.setFloat32(offset + 12, p.posZ, true);
    view.setFloat32(offset + 16, p.yaw, true);
    view.setFloat32(offset + 20, p.pitch, true);
    view.setUint32(offset + 24, p.timestamp, true);
  }

  // Write count
  const countArr = new Uint32Array(sab, INBOUND_COUNT_OFFSET, 1);
  Atomics.store(countArr, 0, count);

  // Bump generation atomically to signal new data
  const gen = new Int32Array(sab, INBOUND_GEN_OFFSET, 1);
  Atomics.add(gen, 0, 1);
}

/** Output structure for reading inbound batch from SAB. */
export interface InboundReadResult {
  count: number;
  generation: number;
}

/**
 * Reads the latest inbound position batch from the SAB.
 * Called from the main thread renderer (60fps useFrame).
 * Returns the generation and count. Caller reads individual player slots.
 */
export function readInboundHeader(
  sab: SharedArrayBuffer,
  lastGen: number,
): InboundReadResult | null {
  const gen = new Int32Array(sab, INBOUND_GEN_OFFSET, 1);
  const currentGen = Atomics.load(gen, 0);

  if (currentGen === lastGen) return null;

  const countArr = new Uint32Array(sab, INBOUND_COUNT_OFFSET, 1);
  const count = Atomics.load(countArr, 0);

  return { count, generation: currentGen };
}

/**
 * Reads a single player's position data from the inbound SAB.
 * Called after readInboundHeader returns non-null.
 */
export function readInboundPlayer(
  sab: SharedArrayBuffer,
  index: number,
): InboundPlayerData {
  const view = new DataView(sab);
  const offset = INBOUND_SLOTS_OFFSET + index * PLAYER_SIZE;

  return {
    slot: view.getUint32(offset, true),
    posX: view.getFloat32(offset + 4, true),
    posY: view.getFloat32(offset + 8, true),
    posZ: view.getFloat32(offset + 12, true),
    yaw: view.getFloat32(offset + 16, true),
    pitch: view.getFloat32(offset + 20, true),
    timestamp: view.getUint32(offset + 24, true),
  };
}
