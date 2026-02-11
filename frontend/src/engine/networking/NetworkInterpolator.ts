/**
 * Generic network interpolator — smooths discrete position updates
 * (e.g. 20Hz server ticks) into continuous motion for 60fps rendering.
 * Handles yaw wrap-around, slight extrapolation on lag, and zero-GC sampling.
 *
 * Depends on: nothing (pure utility)
 * Used by: NetworkedCapsule, any networked entity renderer
 */

const PI = Math.PI;
const TWO_PI = PI * 2;

export interface NetSnapshot {
  position: [number, number, number];
  yaw: number;
}

export class NetworkInterpolator {
  private readonly _prev: NetSnapshot = { position: [0, 0, 0], yaw: 0 };
  private readonly _curr: NetSnapshot = { position: [0, 0, 0], yaw: 0 };
  private readonly _out: NetSnapshot = { position: [0, 0, 0], yaw: 0 };
  private _updateTime = 0;
  private _initialized = false;
  private readonly _intervalMs: number;

  constructor(intervalMs = 50) {
    this._intervalMs = intervalMs;
  }

  /** Push a new authoritative snapshot from the network. Deep-copies values. */
  push(snapshot: NetSnapshot): void {
    const now = performance.now();
    if (!this._initialized) {
      this._copy(snapshot, this._prev);
      this._copy(snapshot, this._curr);
      this._initialized = true;
      this._updateTime = now;
      return;
    }
    this._copy(this._curr, this._prev);
    this._copy(snapshot, this._curr);
    this._updateTime = now;
  }

  /**
   * Get interpolated position/yaw for the current frame.
   * Returns null if no data yet. Reuses internal buffer — zero allocations.
   * Optional `out` param to write into caller-owned object.
   */
  sample(out?: NetSnapshot): NetSnapshot | null {
    if (!this._initialized) return null;

    const elapsed = performance.now() - this._updateTime;
    // Allow slight extrapolation (1.05) to coast through small jitter
    const t = Math.min(elapsed / this._intervalMs, 1.05);

    const target = out ?? this._out;
    const p = this._prev.position;
    const c = this._curr.position;

    target.position[0] = p[0] + (c[0] - p[0]) * t;
    target.position[1] = p[1] + (c[1] - p[1]) * t;
    target.position[2] = p[2] + (c[2] - p[2]) * t;

    // Shortest-path yaw interpolation (radians, handles wrap-around)
    let delta = this._curr.yaw - this._prev.yaw;
    delta = ((delta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
    target.yaw = this._prev.yaw + delta * t;

    return target;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  reset(): void {
    this._initialized = false;
    this._updateTime = 0;
  }

  /** Copy snapshot values without changing object references. */
  private _copy(src: NetSnapshot, dest: NetSnapshot): void {
    dest.position[0] = src.position[0];
    dest.position[1] = src.position[1];
    dest.position[2] = src.position[2];
    dest.yaw = src.yaw;
  }
}
