/**
 * Generic network interpolator — smooths discrete position updates
 * (e.g. 20Hz server ticks) into continuous motion for 60fps rendering.
 * Uses a snapshot buffer with fixed render delay for smooth, jitter-free motion.
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

/** Internal timestamped snapshot for the buffer. */
interface TimedSnapshot {
  position: [number, number, number];
  yaw: number;
  time: number;
}

/**
 * Snapshot buffer interpolator with fixed render delay.
 * Buffers snapshots and interpolates between them at a fixed delay behind real-time,
 * producing smooth motion regardless of jitter in network tick timing.
 */
export class NetworkInterpolator {
  /** Ring buffer of received snapshots (oldest first). */
  private readonly _buffer: TimedSnapshot[] = [];
  private readonly _out: NetSnapshot = { position: [0, 0, 0], yaw: 0 };
  private _initialized = false;
  private readonly _intervalMs: number;

  /** Render delay behind latest snapshot — trades latency for smoothness. */
  private readonly _renderDelayMs: number;
  /** Max buffer size before trimming old snapshots. */
  private static readonly MAX_BUFFER = 10;
  /** Max extrapolation time beyond last two snapshots (ms). */
  private static readonly MAX_EXTRAP_MS = 150;

  constructor(intervalMs = 50) {
    this._intervalMs = intervalMs;
    // Render delay = 2 server ticks behind — enough for smooth lerp
    this._renderDelayMs = intervalMs * 2;
  }

  /** Push a new authoritative snapshot from the network. Deep-copies values. */
  push(snapshot: NetSnapshot): void {
    const now = performance.now();

    // Add to buffer — deep copy position array
    this._buffer.push({
      position: [snapshot.position[0], snapshot.position[1], snapshot.position[2]],
      yaw: snapshot.yaw,
      time: now,
    });
    this._initialized = true;

    // Trim old entries (keep last MAX_BUFFER)
    while (this._buffer.length > NetworkInterpolator.MAX_BUFFER) {
      this._buffer.shift();
    }
  }

  /**
   * Get interpolated position/yaw for the current frame.
   * Renders at a fixed delay behind real-time, lerping between buffered snapshots.
   * Falls back to extrapolation if buffer is exhausted.
   * Returns null if no data yet. Reuses internal buffer — zero allocations on output.
   */
  sample(out?: NetSnapshot): NetSnapshot | null {
    if (!this._initialized || this._buffer.length === 0) return null;

    const target = out ?? this._out;
    const now = performance.now();
    const renderTime = now - this._renderDelayMs;

    // If only one snapshot, use it directly (no interpolation possible)
    if (this._buffer.length === 1) {
      const s = this._buffer[0];
      target.position[0] = s.position[0];
      target.position[1] = s.position[1];
      target.position[2] = s.position[2];
      target.yaw = s.yaw;
      return target;
    }

    // Find the two snapshots that bracket renderTime
    let from: TimedSnapshot | null = null;
    let to: TimedSnapshot | null = null;

    for (let i = 0; i < this._buffer.length - 1; i++) {
      if (this._buffer[i].time <= renderTime && this._buffer[i + 1].time >= renderTime) {
        from = this._buffer[i];
        to = this._buffer[i + 1];
        break;
      }
    }

    if (from && to) {
      // Standard interpolation between two buffered snapshots
      const span = to.time - from.time;
      const t = span > 0 ? (renderTime - from.time) / span : 0;

      target.position[0] = from.position[0] + (to.position[0] - from.position[0]) * t;
      target.position[1] = from.position[1] + (to.position[1] - from.position[1]) * t;
      target.position[2] = from.position[2] + (to.position[2] - from.position[2]) * t;

      // Shortest-path yaw interpolation
      let yawDelta = to.yaw - from.yaw;
      yawDelta = ((yawDelta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
      target.yaw = from.yaw + yawDelta * t;
    } else if (renderTime > this._buffer[this._buffer.length - 1].time) {
      // renderTime is AHEAD of all buffered snapshots — extrapolate from last two
      const len = this._buffer.length;
      const a = this._buffer[len - 2];
      const b = this._buffer[len - 1];
      const span = b.time - a.time;

      if (span > 0) {
        const extraMs = Math.min(renderTime - b.time, NetworkInterpolator.MAX_EXTRAP_MS);
        const velScale = extraMs / span;

        target.position[0] = b.position[0] + (b.position[0] - a.position[0]) * velScale;
        target.position[1] = b.position[1] + (b.position[1] - a.position[1]) * velScale;
        target.position[2] = b.position[2] + (b.position[2] - a.position[2]) * velScale;

        let yawDelta = b.yaw - a.yaw;
        yawDelta = ((yawDelta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
        target.yaw = b.yaw + yawDelta * velScale;
      } else {
        // Identical timestamps — use last position
        target.position[0] = b.position[0];
        target.position[1] = b.position[1];
        target.position[2] = b.position[2];
        target.yaw = b.yaw;
      }
    } else {
      // renderTime is BEFORE all buffered snapshots — use oldest
      const s = this._buffer[0];
      target.position[0] = s.position[0];
      target.position[1] = s.position[1];
      target.position[2] = s.position[2];
      target.yaw = s.yaw;
    }

    // Clean up old snapshots that are no longer needed (before renderTime - margin)
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
    this._buffer.length = 0;
  }
}
