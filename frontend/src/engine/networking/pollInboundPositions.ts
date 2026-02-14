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
import { devLog } from '@engine/stores/devLogStore';

/** Throttle for slot-miss warnings to avoid spam. */
let _slotMissLogTimer = 0;
const _missedSlots = new Set<number>();
const MISS_LOG_INTERVAL_MS = 2000;

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
  const now = performance.now();
  _lastReadIdx = readInboundRing(sab, _lastReadIdx, (p: InboundPlayerData) => {
    const playerId = slotToPlayer.get(p.slot);
    if (!playerId) {
      _missedSlots.add(p.slot);
      return;
    }

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

  // Throttled warning for missed slots
  if (_missedSlots.size > 0 && now - _slotMissLogTimer > MISS_LOG_INTERVAL_MS) {
    _slotMissLogTimer = now;
    const mapEntries = Array.from(slotToPlayer.entries()).map(([s, id]) => `${s}→${id}`).join(', ');
    devLog.warn('Net', `pollInbound: no playerId for slots [${[..._missedSlots].join(',')}] slotMap=[${mapEntries}]`);
    _missedSlots.clear();
  }
}
