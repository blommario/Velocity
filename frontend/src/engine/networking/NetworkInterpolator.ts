/**
 * Generic network interpolator — smooths discrete position updates
 * (e.g. 20Hz server ticks) into continuous motion for 60fps rendering.
 * Uses a snapshot buffer with smoothed clock offset and adaptive render delay.
 *
 * Key design: sample() uses performance.now() (not buffer-relative time) so
 * renderTime advances every frame regardless of snapshot arrival rate. Combined
 * with cubic hermite spline interpolation this produces fluid motion at any
 * framerate from sparse 20Hz server ticks.
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

/** Internal buffered snapshot with canonical time and estimated velocity for hermite spline. */
interface BufferedSnapshot {
  position: [number, number, number];
  velocity: [number, number, number];
  yaw: number;
  pitch: number;
  time: number;
}

/** Wrap-aware shortest-path angle delta in [-PI, PI]. */
function wrapDelta(delta: number): number {
  return ((delta + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
}

/**
 * Cubic hermite basis: h00, h10, h01, h11 for parameter t in [0,1].
 * Returns smoothly interpolated value given positions p0/p1 and tangents m0/m1.
 */
function hermite(t: number, p0: number, m0: number, p1: number, m1: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0
    + (t3 - 2 * t2 + t) * m0
    + (-2 * t3 + 3 * t2) * p1
    + (t3 - t2) * m1;
}

/** Pre-allocated velocity temp to avoid tuple allocation in push() hot path. */
const _vel: [number, number, number] = [0, 0, 0];

// ── Snapshot object pool ──
// At 1000+ players × 20Hz, push()/trim() churn ~20k objects/sec.
// Pool recycles trimmed BufferedSnapshots to avoid GC pressure.
const _pool: BufferedSnapshot[] = [];
const MAX_POOL = 256;

function acquireSnapshot(): BufferedSnapshot {
  if (_pool.length > 0) return _pool.pop()!;
  return { position: [0, 0, 0], velocity: [0, 0, 0], yaw: 0, pitch: 0, time: 0 };
}

function releaseSnapshot(s: BufferedSnapshot): void {
  if (_pool.length < MAX_POOL) _pool.push(s);
}

/**
 * Snapshot buffer interpolator with adaptive render delay.
 * Buffers snapshots and interpolates between them using cubic hermite splines
 * at a dynamic delay behind the newest snapshot, producing smooth motion
 * regardless of network jitter.
 *
 * Uses a snapshot object pool to eliminate GC pressure at scale (1000+ players).
 * Buffer trimming returns snapshots to the pool; push() acquires from the pool.
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

  constructor(intervalMs = 10) {
    this._intervalMs = intervalMs;
    this._minDelayMs = intervalMs * 1.5;
    this._maxDelayMs = intervalMs * 4;
    this._adaptiveDelayMs = intervalMs * 2;
  }

  /** Push a new authoritative snapshot from the network. Mutates pooled objects in-place. */
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

    // Track jitter for adaptive delay — skip negative/zero intervals (out-of-order or duplicate packets)
    if (this._lastSnapshotTime > 0) {
      const interval = time - this._lastSnapshotTime;
      if (interval > 0) {
        const deviation = Math.abs(interval - this._intervalMs);
        this._jitterEma = this._jitterEma * (1 - NetworkInterpolator.JITTER_EMA_ALPHA)
          + deviation * NetworkInterpolator.JITTER_EMA_ALPHA;
      }
    }
    this._lastSnapshotTime = time;

    // Adaptive delay: 2 intervals + 2× jitter, clamped
    const rawDelay = this._intervalMs * 2 + this._jitterEma * 2;
    this._adaptiveDelayMs = Math.max(this._minDelayMs, Math.min(rawDelay, this._maxDelayMs));

    // Estimate velocity from the previous snapshot (finite difference).
    // On micro-dt (duplicate timestamps / batched packets) inherit previous velocity
    // to maintain tangent continuity and avoid Infinity/spike from division.
    _vel[0] = 0; _vel[1] = 0; _vel[2] = 0;
    if (this._buffer.length > 0) {
      const prev = this._buffer[this._buffer.length - 1];
      const dt = time - prev.time;
      if (dt > NetworkInterpolator.MIN_SPAN) {
        _vel[0] = (snapshot.position[0] - prev.position[0]) / dt;
        _vel[1] = (snapshot.position[1] - prev.position[1]) / dt;
        _vel[2] = (snapshot.position[2] - prev.position[2]) / dt;
      } else {
        // Micro-dt — inherit previous velocity for tangent continuity
        _vel[0] = prev.velocity[0];
        _vel[1] = prev.velocity[1];
        _vel[2] = prev.velocity[2];
      }
    }

    // Acquire from pool and write in-place — zero allocation in steady state
    const entry = acquireSnapshot();
    entry.position[0] = snapshot.position[0];
    entry.position[1] = snapshot.position[1];
    entry.position[2] = snapshot.position[2];
    entry.velocity[0] = _vel[0];
    entry.velocity[1] = _vel[1];
    entry.velocity[2] = _vel[2];
    entry.yaw = snapshot.yaw;
    entry.pitch = snapshot.pitch;
    entry.time = time;
    this._buffer.push(entry);
    this._initialized = true;

    // Evict oldest — return to pool
    while (this._buffer.length > NetworkInterpolator.MAX_BUFFER) {
      releaseSnapshot(this._buffer.shift()!);
    }
  }

  /**
   * Get interpolated position/yaw/pitch for the current frame.
   * Uses performance.now() to compute a continuous renderTime that advances
   * every frame — not just when snapshots arrive — eliminating the stutter
   * from 20Hz discrete updates. Cubic hermite splines produce smooth curves
   * through the snapshot positions.
   */
  sample(out?: NetSnapshot): NetSnapshot | null {
    if (!this._initialized || this._buffer.length === 0) return null;

    const target = out ?? this._out;
    // Use wall-clock time so renderTime advances continuously every frame,
    // not only when a new snapshot arrives.
    const renderTime = performance.now() - this._adaptiveDelayMs;

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

    // Find bracketing snapshots — search backwards since renderTime is usually near buffer tail
    let fromIdx = -1;

    for (let i = this._buffer.length - 2; i >= 0; i--) {
      if (this._buffer[i].time <= renderTime) {
        fromIdx = i;
        break;
      }
    }

    if (fromIdx >= 0 && fromIdx < this._buffer.length - 1) {
      const from = this._buffer[fromIdx];
      const to = this._buffer[fromIdx + 1];
      const span = to.time - from.time;
      const t = span > NetworkInterpolator.MIN_SPAN
        ? (renderTime - from.time) / span
        : 0;

      // Cubic hermite interpolation — tangents scaled by span for correct parameterisation
      const m0x = from.velocity[0] * span;
      const m0y = from.velocity[1] * span;
      const m0z = from.velocity[2] * span;
      const m1x = to.velocity[0] * span;
      const m1y = to.velocity[1] * span;
      const m1z = to.velocity[2] * span;

      target.position[0] = hermite(t, from.position[0], m0x, to.position[0], m1x);
      target.position[1] = hermite(t, from.position[1], m0y, to.position[1], m1y);
      target.position[2] = hermite(t, from.position[2], m0z, to.position[2], m1z);

      // Angles: linear lerp with yaw wrap-around (hermite on angles can overshoot)
      const yawDelta = wrapDelta(to.yaw - from.yaw);
      target.yaw = from.yaw + yawDelta * t;
      target.pitch = from.pitch + (to.pitch - from.pitch) * t;
    } else if (renderTime > this._buffer[this._buffer.length - 1].time) {
      // Ahead of buffer — extrapolate using last snapshot's velocity
      const b = this._buffer[this._buffer.length - 1];
      const extraMs = Math.min(renderTime - b.time, NetworkInterpolator.MAX_EXTRAP_MS);

      target.position[0] = b.position[0] + b.velocity[0] * extraMs;
      target.position[1] = b.position[1] + b.velocity[1] * extraMs;
      target.position[2] = b.position[2] + b.velocity[2] * extraMs;

      // Extrapolate rotation from last two snapshots if available
      if (this._buffer.length >= 2) {
        const a = this._buffer[this._buffer.length - 2];
        const span = b.time - a.time;
        if (span > NetworkInterpolator.MIN_SPAN) {
          const yawDelta = wrapDelta(b.yaw - a.yaw);
          target.yaw = b.yaw + (yawDelta / span) * extraMs;
          target.pitch = b.pitch + ((b.pitch - a.pitch) / span) * extraMs;
        } else {
          target.yaw = b.yaw;
          target.pitch = b.pitch;
        }
      } else {
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

    // Trim snapshots older than render window (keep at least 2) — return to pool
    const trimTime = renderTime - this._adaptiveDelayMs;
    while (this._buffer.length > 2 && this._buffer[0].time < trimTime) {
      releaseSnapshot(this._buffer.shift()!);
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
    // Return all buffered snapshots to pool before clearing
    for (let i = 0; i < this._buffer.length; i++) {
      releaseSnapshot(this._buffer[i]);
    }
    this._buffer.length = 0;
  }
}
