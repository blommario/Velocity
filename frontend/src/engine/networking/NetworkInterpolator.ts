/**
 * Generic network interpolator — smooths discrete position updates
 * (e.g. 20Hz server ticks) into continuous motion for 60fps rendering.
 * Uses a snapshot buffer with server timestamps and fixed render delay
 * for smooth, jitter-free motion independent of network arrival variance.
 * Handles yaw wrap-around.
 *
 * Depends on: nothing (pure utility)
 * Used by: NetworkedCapsule, NetworkedPlayer, any networked entity renderer
 */

const PI = Math.PI;
const TWO_PI = PI * 2;

export interface NetSnapshot {
  position: [number, number, number];
  yaw: number;
  /** Server-stamped time in ms (e.g. ms since match start). 0 = no server time available. */
  serverTime: number;
}

/** Internal buffered snapshot. Uses server time when available, arrival time as fallback. */
interface BufferedSnapshot {
  position: [number, number, number];
  yaw: number;
  /** Canonical time used for interpolation (server time mapped to local clock, or arrival time). */
  time: number;
}

/**
 * Snapshot buffer interpolator with fixed render delay.
 * Buffers snapshots and interpolates between them at a fixed delay behind the
 * newest snapshot, producing smooth motion regardless of network jitter.
 *
 * When server timestamps are available, they are used to compute inter-snapshot
 * intervals, eliminating arrival-time jitter. A clock offset is maintained to
 * map server time into the local performance.now() domain.
 */
export class NetworkInterpolator {
  private readonly _buffer: BufferedSnapshot[] = [];
  private readonly _out: NetSnapshot = { position: [0, 0, 0], yaw: 0, serverTime: 0 };
  private _initialized = false;
  private readonly _intervalMs: number;

  /** Render delay behind latest snapshot — trades latency for smoothness. */
  private readonly _renderDelayMs: number;
  /** Offset: performance.now() - serverTime at first calibration. */
  private _clockOffset = 0;
  private _clockCalibrated = false;

  private static readonly MAX_BUFFER = 10;
  private static readonly MAX_EXTRAP_MS = 150;
  /** Minimum time span (ms) between two snapshots to consider for velocity calc. */
  private static readonly MIN_SPAN = 1;

  constructor(intervalMs = 50) {
    this._intervalMs = intervalMs;
    this._renderDelayMs = intervalMs * 2;
  }

  /** Push a new authoritative snapshot from the network. Deep-copies values. */
  push(snapshot: NetSnapshot): void {
    const now = performance.now();
    let time: number;

    if (snapshot.serverTime > 0) {
      // Calibrate clock offset on first server-timestamped snapshot
      if (!this._clockCalibrated) {
        this._clockOffset = now - snapshot.serverTime;
        this._clockCalibrated = true;
      }
      // Map server time to local clock domain
      time = snapshot.serverTime + this._clockOffset;
    } else {
      // No server timestamp — fall back to arrival time
      time = now;
    }

    this._buffer.push({
      position: [snapshot.position[0], snapshot.position[1], snapshot.position[2]],
      yaw: snapshot.yaw,
      time,
    });
    this._initialized = true;

    // Trim old entries
    while (this._buffer.length > NetworkInterpolator.MAX_BUFFER) {
      this._buffer.shift();
    }
  }

  /**
   * Get interpolated position/yaw for the current frame.
   * Renders at a fixed delay behind the newest buffered snapshot,
   * lerping between the two snapshots that bracket the render time.
   * Falls back to extrapolation if buffer is exhausted.
   */
  sample(out?: NetSnapshot): NetSnapshot | null {
    if (!this._initialized || this._buffer.length === 0) return null;

    const target = out ?? this._out;

    // Compute render time: delay behind the HEAD of the buffer
    // This makes the delay relative to data we actually have, not wall clock
    const newestTime = this._buffer[this._buffer.length - 1].time;
    const renderTime = newestTime - this._renderDelayMs;

    // Single snapshot — snap to it
    if (this._buffer.length === 1) {
      const s = this._buffer[0];
      target.position[0] = s.position[0];
      target.position[1] = s.position[1];
      target.position[2] = s.position[2];
      target.yaw = s.yaw;
      return target;
    }

    // Find bracketing snapshots
    let from: BufferedSnapshot | null = null;
    let to: BufferedSnapshot | null = null;

    for (let i = 0; i < this._buffer.length - 1; i++) {
      if (this._buffer[i].time <= renderTime && this._buffer[i + 1].time >= renderTime) {
        from = this._buffer[i];
        to = this._buffer[i + 1];
        break;
      }
    }

    if (from && to) {
      // Standard interpolation
      const span = to.time - from.time;
      const t = span > NetworkInterpolator.MIN_SPAN
        ? (renderTime - from.time) / span
        : 0;

      target.position[0] = from.position[0] + (to.position[0] - from.position[0]) * t;
      target.position[1] = from.position[1] + (to.position[1] - from.position[1]) * t;
      target.position[2] = from.position[2] + (to.position[2] - from.position[2]) * t;

      let yawDelta = to.yaw - from.yaw;
      yawDelta = ((yawDelta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
      target.yaw = from.yaw + yawDelta * t;
    } else if (renderTime > newestTime) {
      // Ahead of buffer — extrapolate
      const len = this._buffer.length;
      const a = this._buffer[len - 2];
      const b = this._buffer[len - 1];
      const span = b.time - a.time;

      if (span > NetworkInterpolator.MIN_SPAN) {
        const extraMs = Math.min(renderTime - b.time, NetworkInterpolator.MAX_EXTRAP_MS);
        const velScale = extraMs / span;

        target.position[0] = b.position[0] + (b.position[0] - a.position[0]) * velScale;
        target.position[1] = b.position[1] + (b.position[1] - a.position[1]) * velScale;
        target.position[2] = b.position[2] + (b.position[2] - a.position[2]) * velScale;

        let yawDelta = b.yaw - a.yaw;
        yawDelta = ((yawDelta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
        target.yaw = b.yaw + yawDelta * velScale;
      } else {
        target.position[0] = b.position[0];
        target.position[1] = b.position[1];
        target.position[2] = b.position[2];
        target.yaw = b.yaw;
      }
    } else {
      // Before buffer — use oldest
      const s = this._buffer[0];
      target.position[0] = s.position[0];
      target.position[1] = s.position[1];
      target.position[2] = s.position[2];
      target.yaw = s.yaw;
    }

    // Trim snapshots older than render window
    const trimTime = renderTime - this._intervalMs;
    while (this._buffer.length > 2 && this._buffer[0].time < trimTime) {
      this._buffer.shift();
    }

    return target;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  reset(): void {
    this._initialized = false;
    this._clockCalibrated = false;
    this._clockOffset = 0;
    this._buffer.length = 0;
  }
}
