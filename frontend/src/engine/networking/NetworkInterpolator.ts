/**
 * Generic network interpolator — smooths discrete position updates
 * (e.g. 20Hz server ticks) into continuous motion for 60fps rendering.
 * Uses a snapshot buffer with smoothed clock offset and adaptive render delay
 * for smooth, jitter-free motion independent of network arrival variance.
 * Handles yaw/pitch interpolation with yaw wrap-around.
 *
 * Depends on: nothing (pure utility)
 * Used by: NetworkedCapsule, NetworkedPlayer, any networked entity renderer
 */

const PI = Math.PI;
const TWO_PI = PI * 2;

export interface NetSnapshot {
  position: [number, number, number];
  yaw: number;
  pitch: number;
  /** Server-stamped time in ms (e.g. ms since match start). 0 = no server time available. */
  serverTime: number;
}

/** Internal buffered snapshot with canonical time for interpolation. */
interface BufferedSnapshot {
  position: [number, number, number];
  yaw: number;
  pitch: number;
  time: number;
}

/**
 * Snapshot buffer interpolator with adaptive render delay.
 * Buffers snapshots and interpolates between them at a dynamic delay behind the
 * newest snapshot, producing smooth motion regardless of network jitter.
 *
 * Clock offset is maintained via EMA — fast initial convergence (simple average
 * for first 4 samples), then slow drift tracking (alpha 0.1). Resets on large jumps.
 */
export class NetworkInterpolator {
  private readonly _buffer: BufferedSnapshot[] = [];
  private readonly _out: NetSnapshot = { position: [0, 0, 0], yaw: 0, pitch: 0, serverTime: 0 };
  private _initialized = false;
  private readonly _intervalMs: number;

  // ── Clock synchronization ──
  private _clockOffset = 0;
  private _clockSamples = 0;
  private static readonly CLOCK_FAST_SAMPLES = 4;
  private static readonly CLOCK_EMA_ALPHA = 0.1;
  private static readonly CLOCK_RESET_THRESHOLD = 500;

  // ── Adaptive render delay ──
  private _lastSnapshotTime = 0;
  private _jitterEma = 0;
  private _adaptiveDelayMs = 0;
  private readonly _minDelayMs: number;
  private readonly _maxDelayMs: number;
  private static readonly JITTER_EMA_ALPHA = 0.15;

  private static readonly MAX_BUFFER = 20;
  private static readonly MAX_EXTRAP_MS = 150;
  private static readonly MIN_SPAN = 1;

  constructor(intervalMs = 50) {
    this._intervalMs = intervalMs;
    this._minDelayMs = intervalMs * 1.5;
    this._maxDelayMs = intervalMs * 4;
    this._adaptiveDelayMs = intervalMs * 2;
  }

  /** Push a new authoritative snapshot from the network. Deep-copies values. */
  push(snapshot: NetSnapshot): void {
    const now = performance.now();
    let time: number;

    if (snapshot.serverTime > 0) {
      const candidateOffset = now - snapshot.serverTime;

      if (this._clockSamples === 0) {
        // First sample — initialize
        this._clockOffset = candidateOffset;
      } else if (Math.abs(candidateOffset - this._clockOffset) > NetworkInterpolator.CLOCK_RESET_THRESHOLD) {
        // Large jump (tab suspend, reconnect) — reset
        this._clockOffset = candidateOffset;
        this._clockSamples = 0;
      } else if (this._clockSamples < NetworkInterpolator.CLOCK_FAST_SAMPLES) {
        // Fast convergence: simple running average
        this._clockOffset += (candidateOffset - this._clockOffset) / (this._clockSamples + 1);
      } else {
        // Steady state: slow EMA for drift tracking
        this._clockOffset += NetworkInterpolator.CLOCK_EMA_ALPHA * (candidateOffset - this._clockOffset);
      }

      this._clockSamples++;
      time = snapshot.serverTime + this._clockOffset;
    } else {
      time = now;
    }

    // Track jitter for adaptive delay
    if (this._lastSnapshotTime > 0) {
      const interval = time - this._lastSnapshotTime;
      const deviation = Math.abs(interval - this._intervalMs);
      this._jitterEma = this._jitterEma * (1 - NetworkInterpolator.JITTER_EMA_ALPHA)
        + deviation * NetworkInterpolator.JITTER_EMA_ALPHA;
    }
    this._lastSnapshotTime = time;

    // Adaptive delay: 2 intervals + 2× jitter, clamped
    const rawDelay = this._intervalMs * 2 + this._jitterEma * 2;
    this._adaptiveDelayMs = Math.max(this._minDelayMs, Math.min(rawDelay, this._maxDelayMs));

    this._buffer.push({
      position: [snapshot.position[0], snapshot.position[1], snapshot.position[2]],
      yaw: snapshot.yaw,
      pitch: snapshot.pitch,
      time,
    });
    this._initialized = true;

    while (this._buffer.length > NetworkInterpolator.MAX_BUFFER) {
      this._buffer.shift();
    }
  }

  /**
   * Get interpolated position/yaw/pitch for the current frame.
   * Renders at an adaptive delay behind the newest buffered snapshot,
   * lerping between the two snapshots that bracket the render time.
   * Falls back to extrapolation if buffer is exhausted.
   */
  sample(out?: NetSnapshot): NetSnapshot | null {
    if (!this._initialized || this._buffer.length === 0) return null;

    const target = out ?? this._out;
    const newestTime = this._buffer[this._buffer.length - 1].time;
    const renderTime = newestTime - this._adaptiveDelayMs;

    // Single snapshot — snap to it
    if (this._buffer.length === 1) {
      const s = this._buffer[0];
      target.position[0] = s.position[0];
      target.position[1] = s.position[1];
      target.position[2] = s.position[2];
      target.yaw = s.yaw;
      target.pitch = s.pitch;
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
      target.pitch = from.pitch + (to.pitch - from.pitch) * t;
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
        target.pitch = b.pitch + (b.pitch - a.pitch) * velScale;
      } else {
        target.position[0] = b.position[0];
        target.position[1] = b.position[1];
        target.position[2] = b.position[2];
        target.yaw = b.yaw;
        target.pitch = b.pitch;
      }
    } else {
      // Before buffer — use oldest
      const s = this._buffer[0];
      target.position[0] = s.position[0];
      target.position[1] = s.position[1];
      target.position[2] = s.position[2];
      target.yaw = s.yaw;
      target.pitch = s.pitch;
    }

    // Trim snapshots older than render window (keep at least 2)
    const trimTime = renderTime - this._adaptiveDelayMs;
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
    this._clockSamples = 0;
    this._clockOffset = 0;
    this._lastSnapshotTime = 0;
    this._jitterEma = 0;
    this._adaptiveDelayMs = this._intervalMs * 2;
    this._buffer.length = 0;
  }
}
