/**
 * Network Web Worker — owns the WebTransport session.
 * Handles position streaming via SharedArrayBuffer and JSON control messages via postMessage.
 *
 * Outbound positions: reads from outbound SAB at 20Hz, sends to server position stream.
 * Inbound positions: reads from server position stream, decodes, writes to inbound SAB.
 * Control messages: bidirectional JSON via a separate QUIC stream, relayed via postMessage.
 *
 * Depends on: NetworkConstants, SharedPositionBuffer, workerProtocol, PositionCodec
 * Used by: WebTransportTransport (spawns this worker)
 */

import { encode, decode } from '@msgpack/msgpack';
import { TRANSPORT_CONFIG, STREAM_TYPE } from './NetworkConstants';
import {
  readOutboundPosition,
  writeInboundBatch,
  type InboundPlayerData,
} from './SharedPositionBuffer';
import { MSG_TYPE } from './PositionCodec';
import type { MainToWorkerMsg, WorkerToMainMsg } from './workerProtocol';
import type { TransportState } from './GameTransport';

// ── State ──

let outSab: SharedArrayBuffer | null = null;
let inSab: SharedArrayBuffer | null = null;
let transport: WebTransport | null = null;
let positionWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
let positionReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let controlWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
let controlReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let outboundTimer: ReturnType<typeof setInterval> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let lastOutboundGen = 0;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isClosed = false;
let url = '';
let token = '';

const _encoder = new TextEncoder();
const _decoder = new TextDecoder();

// Pre-allocated inbound player array for zero-GC batch decoding
const _inboundPlayers: InboundPlayerData[] = Array.from(
  { length: TRANSPORT_CONFIG.MAX_REMOTE_PLAYERS },
  () => ({ slot: 0, posX: 0, posY: 0, posZ: 0, yaw: 0, pitch: 0, timestamp: 0 }),
);

const ROTATION_SCALE = 10000;
const BYTES_PER_PLAYER = 25;

// ── Helpers ──

function post(msg: WorkerToMainMsg): void {
  self.postMessage(msg);
}

function postState(state: TransportState): void {
  post({ type: 'state_change', state });
}

// ── Connect ──

async function doConnect(): Promise<void> {
  if (isClosed) return;

  postState('connecting');

  try {
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}token=${encodeURIComponent(token)}`;

    transport = new WebTransport(fullUrl);
    await transport.ready;

    // Open two bidirectional streams: position + control.
    // Write a type byte as the first byte on each stream so the server
    // can identify them regardless of QUIC accept order.
    const posStream = await transport.createBidirectionalStream();
    const posWriter = posStream.writable.getWriter();
    await posWriter.write(new Uint8Array([STREAM_TYPE.POSITION]));
    positionWriter = posWriter;
    positionReader = posStream.readable.getReader();

    const ctrlStream = await transport.createBidirectionalStream();
    const ctrlWriter = ctrlStream.writable.getWriter();
    await ctrlWriter.write(new Uint8Array([STREAM_TYPE.CONTROL]));
    controlWriter = ctrlWriter;
    controlReader = ctrlStream.readable.getReader();

    const wasReconnect = reconnectAttempts > 0;
    reconnectAttempts = 0;

    postState('open');

    if (wasReconnect) {
      post({ type: 'reconnect' });
    }

    // Start background loops
    startOutboundLoop();
    startPing();
    readPositionStream();
    readControlStream();

    // Wait for session close
    await transport.closed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message });
  } finally {
    cleanup();
    postState('closed');
    post({ type: 'closed', code: 0, reason: 'Transport closed' });

    if (!isClosed) {
      scheduleReconnect();
    }
  }
}

// ── Outbound position loop (20Hz) ──

function startOutboundLoop(): void {
  stopOutboundLoop();
  outboundTimer = setInterval(sendOutboundPosition, TRANSPORT_CONFIG.WORKER_SEND_INTERVAL_MS);
}

function stopOutboundLoop(): void {
  if (outboundTimer !== null) {
    clearInterval(outboundTimer);
    outboundTimer = null;
  }
}

function sendOutboundPosition(): void {
  if (!outSab || !positionWriter) return;

  const result = readOutboundPosition(outSab, lastOutboundGen);
  if (!result) return;

  lastOutboundGen = result.generation;

  // Send the raw 20 bytes to the server via the position stream
  const copy = new Uint8Array(result.data.length);
  copy.set(result.data);

  positionWriter.write(copy).catch(() => {
    // Stream may be closing
  });
}

// ── Inbound position reader ──

async function readPositionStream(): Promise<void> {
  if (!positionReader || !inSab) return;

  try {
    while (true) {
      const { value, done } = await positionReader.read();
      if (done || !value) break;

      // Parse position batch (same format as existing PositionCodec)
      if (value.length < 2) continue;
      if (value[0] !== MSG_TYPE.POSITION_BATCH) continue;

      const count = value[1];
      const view = new DataView(value.buffer, value.byteOffset, value.byteLength);

      for (let i = 0; i < count; i++) {
        const offset = 2 + i * BYTES_PER_PLAYER;
        if (offset + BYTES_PER_PLAYER > value.length) break;

        const p = _inboundPlayers[i];
        p.slot = view.getUint8(offset);
        p.posX = view.getFloat32(offset + 1, true);
        p.posY = view.getFloat32(offset + 5, true);
        p.posZ = view.getFloat32(offset + 9, true);
        p.yaw = view.getInt16(offset + 13, true) / ROTATION_SCALE;
        p.pitch = view.getInt16(offset + 15, true) / ROTATION_SCALE;
        p.timestamp = view.getUint32(offset + 20, true);
      }

      writeInboundBatch(inSab, _inboundPlayers, count);
    }
  } catch {
    // Stream closed
  }
}

// ── Control stream (JSON + MessagePack) ──

async function readControlStream(): Promise<void> {
  if (!controlReader) return;

  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { value, done } = await controlReader.read();
      if (done || !value) break;

      // Accumulate data and parse length-prefixed frames
      const combined = new Uint8Array(buffer.length + value.length);
      combined.set(buffer);
      combined.set(value, buffer.length);
      buffer = combined;

      while (buffer.length >= 4) {
        const frameLen = new DataView(buffer.buffer, buffer.byteOffset).getUint32(0, true);
        if (buffer.length < 4 + frameLen) break;

        const frameData = buffer.slice(4, 4 + frameLen);
        buffer = buffer.slice(4 + frameLen);

        try {
          let parsed: { type?: string; [key: string]: unknown };

          if (frameData[0] === MSG_TYPE.MSGPACK) {
            // MessagePack: skip the 0x81 prefix byte, decode binary
            parsed = decode(frameData.slice(1)) as typeof parsed;
          } else {
            // JSON fallback: skip the 0x80 prefix byte if present
            const text = _decoder.decode(frameData);
            const jsonText = frameData[0] === MSG_TYPE.JSON ? text.slice(1) : text;
            parsed = JSON.parse(jsonText) as typeof parsed;
          }

          const msgType = parsed.type;

          if (msgType === 'pong') {
            const t = parsed.t as number;
            const rtt = Date.now() - t;
            post({ type: 'latency', ms: Math.round(rtt / 2) });
            continue;
          }

          if (msgType) {
            post({ type: 'json_message', msgType, data: parsed.data ?? parsed });
          }
        } catch {
          // Malformed frame — ignore
        }
      }
    }
  } catch {
    // Stream closed
  }
}

function sendControlToServer(payload: Record<string, unknown>): void {
  if (!controlWriter) return;

  const msgpackBytes = encode(payload);

  // Frame: [0x81 MessagePack marker] + binary payload
  const frame = new Uint8Array(1 + msgpackBytes.length);
  frame[0] = MSG_TYPE.MSGPACK;
  frame.set(new Uint8Array(msgpackBytes), 1);

  // Length-prefix the frame: [4B length LE] + frame
  const lengthBuf = new Uint8Array(4);
  new DataView(lengthBuf.buffer).setUint32(0, frame.length, true);

  const packet = new Uint8Array(4 + frame.length);
  packet.set(lengthBuf);
  packet.set(frame, 4);

  controlWriter.write(packet).catch(() => {
    // Stream may be closing
  });
}

// ── Ping/pong ──

function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => {
    sendControlToServer({ type: 'ping', t: Date.now() });
  }, TRANSPORT_CONFIG.PING_INTERVAL_MS);
}

function stopPing(): void {
  if (pingTimer !== null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// ── Reconnect ──

function scheduleReconnect(): void {
  if (reconnectAttempts >= TRANSPORT_CONFIG.RECONNECT_MAX_ATTEMPTS) {
    post({
      type: 'reconnect_attempt',
      attempt: reconnectAttempts,
      maxAttempts: TRANSPORT_CONFIG.RECONNECT_MAX_ATTEMPTS,
    });
    return;
  }

  const delay = Math.min(
    TRANSPORT_CONFIG.RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
    TRANSPORT_CONFIG.RECONNECT_MAX_DELAY_MS,
  );

  reconnectAttempts++;
  post({
    type: 'reconnect_attempt',
    attempt: reconnectAttempts,
    maxAttempts: TRANSPORT_CONFIG.RECONNECT_MAX_ATTEMPTS,
  });

  reconnectTimer = setTimeout(() => doConnect(), delay);
}

function clearReconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// ── Cleanup ──

function cleanup(): void {
  stopOutboundLoop();
  stopPing();

  try { positionWriter?.close(); } catch { /* noop */ }
  try { controlWriter?.close(); } catch { /* noop */ }
  try { positionReader?.cancel(); } catch { /* noop */ }
  try { controlReader?.cancel(); } catch { /* noop */ }

  positionWriter = null;
  positionReader = null;
  controlWriter = null;
  controlReader = null;
}

// ── Message handler ──

self.onmessage = (e: MessageEvent<MainToWorkerMsg>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'connect':
      isClosed = false;
      reconnectAttempts = 0;
      url = msg.url;
      token = msg.token;
      outSab = msg.outSab;
      inSab = msg.inSab;
      lastOutboundGen = 0;
      doConnect();
      break;

    case 'disconnect':
      isClosed = true;
      clearReconnect();
      cleanup();
      try { transport?.close(); } catch { /* noop */ }
      transport = null;
      postState('disconnected');
      break;

    case 'send_json':
      sendControlToServer(msg.payload);
      break;

    case 'reset_reconnect':
      reconnectAttempts = 0;
      clearReconnect();
      if (!transport || transport.ready === undefined) {
        doConnect();
      }
      break;
  }
};
