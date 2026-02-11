/**
 * Binary encoder/decoder for multiplayer position data.
 * Uses pre-allocated ArrayBuffer + DataView for zero-GC per-frame operation.
 *
 * Protocol (client → server): 20 bytes
 * [1B msgType=0x01][4B posX f32][4B posY f32][4B posZ f32][2B yaw i16][2B pitch i16][2B speed u16][1B checkpoint]
 *
 * Protocol (server → client batch): 2 + 25N bytes
 * [1B msgType=0x02][1B count][per player: 1B slot + 4B posX + 4B posY + 4B posZ + 2B yaw + 2B pitch + 2B speed + 1B checkpoint + 4B timestamp]
 *
 * Depends on: nothing (pure functions + pre-allocated buffers)
 * Used by: GameTransport, multiplayerStore
 */

/** Binary message type constants — must match backend WebSocketSettings. */
export const MSG_TYPE = {
  POSITION: 0x01,
  POSITION_BATCH: 0x02,
  JSON: 0x80,
} as const;

/** Quantization factor for yaw/pitch: radians × 10000 → int16. */
const ROTATION_SCALE = 10000;

/** Quantization factor for speed: u/s × 10 → uint16. */
const SPEED_SCALE = 10;

/** Bytes per player in a position batch (server → client). */
const BYTES_PER_PLAYER = 25;

/** Client → server position message size. */
const ENCODE_SIZE = 20;

export interface PositionSnapshot {
  slot: number;
  posX: number;
  posY: number;
  posZ: number;
  yaw: number;
  pitch: number;
  speed: number;
  checkpoint: number;
  timestamp: number;
}

// ── Pre-allocated encode buffer (reused every frame) ──
const _encodeBuffer = new ArrayBuffer(ENCODE_SIZE);
const _encodeView = new DataView(_encodeBuffer);

/**
 * Encodes a local player's position into a binary message (client → server).
 * Returns a reference to the shared buffer — caller must send before next call.
 */
export function encodePosition(
  posX: number,
  posY: number,
  posZ: number,
  yaw: number,
  pitch: number,
  speed: number,
  checkpoint: number,
): ArrayBuffer {
  _encodeView.setUint8(0, MSG_TYPE.POSITION);
  _encodeView.setFloat32(1, posX, true);
  _encodeView.setFloat32(5, posY, true);
  _encodeView.setFloat32(9, posZ, true);
  _encodeView.setInt16(13, Math.round(yaw * ROTATION_SCALE), true);
  _encodeView.setInt16(15, Math.round(pitch * ROTATION_SCALE), true);
  _encodeView.setUint16(17, Math.round(speed * SPEED_SCALE), true);
  _encodeView.setUint8(19, checkpoint);
  return _encodeBuffer;
}

// ── Pre-allocated decode output (reused every frame) ──
const _maxPlayers = 32;
const _snapshots: PositionSnapshot[] = Array.from({ length: _maxPlayers }, () => ({
  slot: 0,
  posX: 0,
  posY: 0,
  posZ: 0,
  yaw: 0,
  pitch: 0,
  speed: 0,
  checkpoint: 0,
  timestamp: 0,
}));

export interface DecodedBatch {
  count: number;
  snapshots: readonly PositionSnapshot[];
}

/**
 * Decodes a position batch from the server (server → client).
 * Returns a reference to the shared snapshot array — caller must consume before next call.
 */
export function decodeBatch(buffer: ArrayBuffer): DecodedBatch {
  const view = new DataView(buffer);
  const count = view.getUint8(1);

  for (let i = 0; i < count; i++) {
    const offset = 2 + i * BYTES_PER_PLAYER;
    const snap = _snapshots[i];

    snap.slot = view.getUint8(offset);
    snap.posX = view.getFloat32(offset + 1, true);
    snap.posY = view.getFloat32(offset + 5, true);
    snap.posZ = view.getFloat32(offset + 9, true);
    snap.yaw = view.getInt16(offset + 13, true) / ROTATION_SCALE;
    snap.pitch = view.getInt16(offset + 15, true) / ROTATION_SCALE;
    snap.speed = view.getUint16(offset + 17, true) / SPEED_SCALE;
    snap.checkpoint = view.getUint8(offset + 19);
    snap.timestamp = view.getUint32(offset + 20, true);
  }

  return { count, snapshots: _snapshots };
}
