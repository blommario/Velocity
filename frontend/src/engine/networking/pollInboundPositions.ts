/**
 * Main-thread poller for inbound remote player positions from SharedArrayBuffer.
 * Called from the render loop (60fps useFrame) to feed NetworkInterpolator buffers.
 *
 * Pure function — no React, no hooks, no side effects beyond calling pushSnapshot.
 *
 * Depends on: SharedPositionBuffer, NetworkInterpolator (NetSnapshot type)
 * Used by: game layer (RemotePlayers component or similar)
 */

import { readInboundHeader, readInboundPlayer } from './SharedPositionBuffer';

/** Tracks the last read generation to avoid re-processing stale data. */
let _lastInboundGen = 0;

/** Resets the generation tracker (call when disconnecting). */
export function resetInboundPoll(): void {
  _lastInboundGen = 0;
}

/**
 * Polls the inbound SharedArrayBuffer for new remote player position data.
 * If new data is available, reads each player slot and calls pushSnapshot.
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
  const result = readInboundHeader(sab, _lastInboundGen);
  if (!result) return;

  _lastInboundGen = result.generation;

  for (let i = 0; i < result.count; i++) {
    const p = readInboundPlayer(sab, i);
    const playerId = slotToPlayer.get(p.slot);
    if (!playerId) continue;

    pushSnapshot(playerId, {
      posX: p.posX,
      posY: p.posY,
      posZ: p.posZ,
      yaw: p.yaw,
      pitch: p.pitch,
      speed: 0, // Speed not in inbound SAB (visual-only, interpolated)
      checkpoint: 0,
      timestamp: p.timestamp,
    });
  }
}
