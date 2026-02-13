/**
 * Generic network interpolator — smooths discrete position updates
 * (e.g. 20Hz server ticks) into continuous motion for 60fps rendering.
 * Uses velocity-based extrapolation for smooth coasting between ticks.
 * Handles yaw wrap-around and zero-GC sampling.
 *
 * Depends on: nothing (pure utility)
 * Used by: NetworkedCapsule, NetworkedPlayer, any networked entity renderer
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
  /** Derived velocity (units/ms) computed from consecutive snapshots. */
  private readonly _vel: [number, number, number] = [0, 0, 0];
  private _yawVel = 0;
  private _updateTime = 0;
  private _initialized = false;
  private readonly _intervalMs: number;
  /** Max extrapolation factor beyond t=1. Higher = more coasting, more risk of overshoot. */
  private static readonly MAX_T = 1.5;

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

    // Derive velocity from prev→curr delta (units per ms)
    // Use actual elapsed time between pushes for accurate velocity,
    // falling back to nominal interval if elapsed is too small
    const elapsed = now - this._updateTime;
    const dt = elapsed > 5 ? elapsed : this._intervalMs;
    const invDt = 1 / dt;
    const p = this._prev.position;
    const c = this._curr.position;
    this._vel[0] = (c[0] - p[0]) * invDt;
    this._vel[1] = (c[1] - p[1]) * invDt;
    this._vel[2] = (c[2] - p[2]) * invDt;

    // Yaw velocity (shortest path)
    let yawDelta = this._curr.yaw - this._prev.yaw;
    yawDelta = ((yawDelta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
    this._yawVel = yawDelta * invDt;

    this._updateTime = now;
  }

  /**
   * Get interpolated position/yaw for the current frame.
   * For t <= 1: lerp between prev and curr.
   * For t > 1: extrapolate from curr using derived velocity.
   * Returns null if no data yet. Reuses internal buffer — zero allocations.
   */
  sample(out?: NetSnapshot): NetSnapshot | null {
    if (!this._initialized) return null;

    const elapsed = performance.now() - this._updateTime;
    const t = Math.min(elapsed / this._intervalMs, NetworkInterpolator.MAX_T);

    const target = out ?? this._out;
    const p = this._prev.position;
    const c = this._curr.position;

    if (t <= 1) {
      // Standard lerp between prev and curr
      target.position[0] = p[0] + (c[0] - p[0]) * t;
      target.position[1] = p[1] + (c[1] - p[1]) * t;
      target.position[2] = p[2] + (c[2] - p[2]) * t;
    } else {
      // Extrapolate from curr using velocity
      const extraMs = (t - 1) * this._intervalMs;
      target.position[0] = c[0] + this._vel[0] * extraMs;
      target.position[1] = c[1] + this._vel[1] * extraMs;
      target.position[2] = c[2] + this._vel[2] * extraMs;
    }

    // Shortest-path yaw interpolation + extrapolation
    let yawDelta = this._curr.yaw - this._prev.yaw;
    yawDelta = ((yawDelta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
    if (t <= 1) {
      target.yaw = this._prev.yaw + yawDelta * t;
    } else {
      const extraMs = (t - 1) * this._intervalMs;
      target.yaw = this._curr.yaw + this._yawVel * extraMs;
    }

    return target;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  reset(): void {
    this._initialized = false;
    this._updateTime = 0;
    this._vel[0] = this._vel[1] = this._vel[2] = 0;
    this._yawVel = 0;
  }

  /** Copy snapshot values without changing object references. */
  private _copy(src: NetSnapshot, dest: NetSnapshot): void {
    dest.position[0] = src.position[0];
    dest.position[1] = src.position[1];
    dest.position[2] = src.position[2];
    dest.yaw = src.yaw;
  }
}
