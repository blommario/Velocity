/**
 * Non-React store of per-player NetworkInterpolators.
 * Binary position batches push directly here — no Zustand, no React re-renders.
 * Renderers (NetworkedPlayer/Capsule) read via useFrame at 60Hz.
 *
 * Depends on: NetworkInterpolator
 * Used by: multiplayerStore (push), RemotePlayers (read in useFrame)
 */
import { NetworkInterpolator, type NetSnapshot } from './NetworkInterpolator';

const _interpolators = new Map<string, NetworkInterpolator>();

/** Snapshot data stored per player for components that need yaw/pitch/speed. */
const _latestSnapshots = new Map<string, NetSnapshot>();

/** Push a new position for a remote player. Creates interpolator on first push. */
export function pushRemoteSnapshot(playerId: string, snapshot: NetSnapshot): void {
  let interp = _interpolators.get(playerId);
  if (!interp) {
    interp = new NetworkInterpolator(10);
    _interpolators.set(playerId, interp);
  }
  interp.push(snapshot);
  _latestSnapshots.set(playerId, snapshot);
}

/** Get the interpolator for a player (used in useFrame). */
export function getInterpolator(playerId: string): NetworkInterpolator | undefined {
  return _interpolators.get(playerId);
}

/** Remove a player's interpolator (on leave/disconnect). */
export function removeInterpolator(playerId: string): void {
  _interpolators.delete(playerId);
  _latestSnapshots.delete(playerId);
}

/** Clear all interpolators (on disconnect/reset). */
export function clearInterpolators(): void {
  _interpolators.clear();
  _latestSnapshots.clear();
}

/** Get all tracked player IDs. */
export function getTrackedPlayerIds(): string[] {
  return Array.from(_interpolators.keys());
}
