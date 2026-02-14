/**
 * SharedArrayBuffer helpers for zero-copy position data transfer
 * between the main thread and the network Web Worker.
 *
 * Outbound SAB (24 bytes): local player position → worker → server
 *   [0-3]   generation (Uint32, Atomics) — main thread bumps after write
 *   [4-23]  position data (20 bytes, same layout as PositionCodec encode)
 *
 * Inbound SAB (7204 bytes): server → worker → remote player positions
 *   Ring buffer with 8 slots. Single-producer (worker), single-consumer (main thread).
 *   [0-3]   writeIndex (Uint32, Atomics) — worker increments after each write
 *   [4...]  8 ring slots × 900 bytes each:
 *     [0-3]   playerCount (Uint32)
 *     [4...]  32 player entries × 28 bytes each:
 *       [0-3]   slot (Uint32)
 *       [4-7]   posX (Float32)
 *       [8-11]  posY (Float32)
 *       [12-15] posZ (Float32)
 *       [16-19] yaw (Float32)
 *       [20-23] pitch (Float32)
 *       [24-27] timestamp (Uint32, ms since match start)
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

// ── Inbound ring buffer (worker writes, main thread reads) ──

const RING_HEADER_OFFSET = 0;
const RING_SLOTS_START = TRANSPORT_CONFIG.INBOUND_RING_HEADER;
const RING_SLOTS = TRANSPORT_CONFIG.INBOUND_RING_SLOTS;
const SLOT_SIZE = TRANSPORT_CONFIG.INBOUND_SLOT_SIZE;
const SLOT_HEADER = TRANSPORT_CONFIG.INBOUND_SLOT_HEADER;
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
 * Writes a decoded position batch into the next ring slot.
 * Called from the worker when a position batch arrives from the server.
 */
export function writeInboundBatch(
  sab: SharedArrayBuffer,
  players: readonly InboundPlayerData[],
  count: number,
): void {
  // Read current write index to find the slot to write into
  const idxArr = new Int32Array(sab, RING_HEADER_OFFSET, 1);
  const writeIdx = Atomics.load(idxArr, 0);
  const ringSlot = writeIdx & (RING_SLOTS - 1); // fast modulo for power-of-2
  const slotBase = RING_SLOTS_START + ringSlot * SLOT_SIZE;

  const view = new DataView(sab);

  // Write player count into slot header
  view.setUint32(slotBase, count, true);

  // Write player data
  for (let i = 0; i < count; i++) {
    const p = players[i];
    const offset = slotBase + SLOT_HEADER + i * PLAYER_SIZE;

    view.setUint32(offset, p.slot, true);
    view.setFloat32(offset + 4, p.posX, true);
    view.setFloat32(offset + 8, p.posY, true);
    view.setFloat32(offset + 12, p.posZ, true);
    view.setFloat32(offset + 16, p.yaw, true);
    view.setFloat32(offset + 20, p.pitch, true);
    view.setUint32(offset + 24, p.timestamp, true);
  }

  // Increment write index atomically (signals new data to reader)
  Atomics.add(idxArr, 0, 1);
}

/**
 * Reads all unread ring slots since lastReadIdx.
 * Returns the new read index, or the same value if nothing new.
 * Calls pushPlayer for each player entry in each unread slot.
 *
 * @param sab - Inbound SharedArrayBuffer
 * @param lastReadIdx - The writeIndex value from the last read
 * @param pushPlayer - Callback for each player in each batch
 * @returns New lastReadIdx to pass on next call
 */
export function readInboundRing(
  sab: SharedArrayBuffer,
  lastReadIdx: number,
  pushPlayer: (player: InboundPlayerData) => void,
): number {
  const idxArr = new Int32Array(sab, RING_HEADER_OFFSET, 1);
  const writeIdx = Atomics.load(idxArr, 0);

  if (writeIdx === lastReadIdx) return lastReadIdx;

  // If we're more than RING_SLOTS behind, skip to avoid reading stale data
  const behind = writeIdx - lastReadIdx;
  const startIdx = behind > RING_SLOTS ? writeIdx - RING_SLOTS : lastReadIdx;

  const view = new DataView(sab);

  for (let idx = startIdx; idx < writeIdx; idx++) {
    const ringSlot = idx & (RING_SLOTS - 1);
    const slotBase = RING_SLOTS_START + ringSlot * SLOT_SIZE;

    const count = view.getUint32(slotBase, true);

    for (let i = 0; i < count; i++) {
      const offset = slotBase + SLOT_HEADER + i * PLAYER_SIZE;

      // Reuse pre-allocated _readPlayer to avoid GC
      _readPlayer.slot = view.getUint32(offset, true);
      _readPlayer.posX = view.getFloat32(offset + 4, true);
      _readPlayer.posY = view.getFloat32(offset + 8, true);
      _readPlayer.posZ = view.getFloat32(offset + 12, true);
      _readPlayer.yaw = view.getFloat32(offset + 16, true);
      _readPlayer.pitch = view.getFloat32(offset + 20, true);
      _readPlayer.timestamp = view.getUint32(offset + 24, true);

      pushPlayer(_readPlayer);
    }
  }

  return writeIdx;
}

/** Pre-allocated read buffer — reused in readInboundRing to avoid GC. */
const _readPlayer: InboundPlayerData = {
  slot: 0, posX: 0, posY: 0, posZ: 0, yaw: 0, pitch: 0, timestamp: 0,
};
