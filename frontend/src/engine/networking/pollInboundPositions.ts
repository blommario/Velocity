/**
 * Main-thread poller for inbound remote player positions from SharedArrayBuffer.
 * Called from the render loop (60fps useFrame) to feed NetworkInterpolator buffers.
 * Reads all unread ring buffer slots since the last poll — no batch is ever lost.
 *
 * Pure function — no React, no hooks, no side effects beyond calling pushSnapshot.
 *
 * Depends on: SharedPositionBuffer
 * Used by: game layer (RemotePlayers component)
 */

import { readInboundRing, type InboundPlayerData } from './SharedPositionBuffer';

/** Tracks the last read ring index to avoid re-processing stale data. */
let _lastReadIdx = 0;

/** Resets the ring read tracker (call when disconnecting). */
export function resetInboundPoll(): void {
  _lastReadIdx = 0;
}

/**
 * Polls the inbound SharedArrayBuffer ring buffer for new remote player position data.
 * Reads all unread slots and calls pushSnapshot for each player entry found.
 *
 * @param sab - The inbound SharedArrayBuffer (from WebTransportTransport.getInboundBuffer())
 * @param slotToPlayer - Map from slot number to player ID string
 * @param pushSnapshot - Callback to push decoded position into the interpolation system
 */
export function pollInboundPositions(
  sab: SharedArrayBuffer,
  slotToPlayer: ReadonlyMap<number, string>,
  pushSnapshot: (playerId: string, snap: {
    posX: number;
    posY: number;
    posZ: number;
    yaw: number;
    pitch: number;
    speed: number;
    checkpoint: number;
    timestamp: number;
  }) => void,
): void {
  _lastReadIdx = readInboundRing(sab, _lastReadIdx, (p: InboundPlayerData) => {
    const playerId = slotToPlayer.get(p.slot);
    if (!playerId) return;

    pushSnapshot(playerId, {
      posX: p.posX,
      posY: p.posY,
      posZ: p.posZ,
      yaw: p.yaw,
      pitch: p.pitch,
      speed: 0,
      checkpoint: 0,
      timestamp: p.timestamp,
    });
  });
}
