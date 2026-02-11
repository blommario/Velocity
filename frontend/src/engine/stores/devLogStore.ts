/**
 * Developer logging store with batched writes, frame timing, and error capture.
 *
 * Depends on: zustand
 * Used by: devLog API (all engine/game modules), PerfMonitor, DevLogPanel
 */
import { create } from 'zustand';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'perf';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  /** Number of times this exact message has been logged consecutively or repeatedly */
  count: number;
}

export interface PerfMetrics {
  fps: number;
  frametime: number;
  frametimeMax: number;
  memoryMB: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/** Per-system frame timing (ms) — written each frame, snapshotted 1x/sec for display */
export interface FrameTimings {
  [system: string]: number;
}

const MAX_ENTRIES = 500;

/** Window in ms within which identical messages get accumulated instead of duplicated */
const ACCUMULATE_WINDOW_MS = 5000;

const PERF_DEFAULTS: PerfMetrics = {
  fps: 0,
  frametime: 0,
  frametimeMax: 0,
  memoryMB: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
};

interface DevLogState {
  entries: LogEntry[];
  nextId: number;
  visible: boolean;
  /** Current filter — null = show all, string = only this source */
  filter: string | null;
  /** Performance metrics updated every second */
  perf: PerfMetrics;
  /** Per-system frame timing snapshot (ms) — updated 1x/sec */
  timings: FrameTimings;
  /** Whether the profiler bar is visible */
  profilerVisible: boolean;
  /** Collected unique source names for filter dropdown */
  sources: string[];
  push: (level: LogLevel, source: string, message: string) => void;
  updatePerf: (metrics: Partial<PerfMetrics>) => void;
  updateTimings: (timings: FrameTimings) => void;
  setFilter: (source: string | null) => void;
  toggleProfiler: () => void;
  toggle: () => void;
  clear: () => void;
}

export const useDevLogStore = create<DevLogState>((set) => ({
  entries: [],
  nextId: 1,
  visible: true,
  filter: null,
  perf: PERF_DEFAULTS,
  timings: {},
  profilerVisible: false,
  sources: [],

  push: (level, source, message) => set((s) => {
    const now = performance.now();
    const sources = s.sources.includes(source) ? s.sources : [...s.sources, source];

    // Accumulate: if the last entry has the same level+source+message within window, bump count
    const last = s.entries.length > 0 ? s.entries[s.entries.length - 1] : null;
    if (
      last &&
      last.level === level &&
      last.source === source &&
      last.message === message &&
      (now - last.timestamp) < ACCUMULATE_WINDOW_MS
    ) {
      const updated = [...s.entries];
      updated[updated.length - 1] = { ...last, count: last.count + 1, timestamp: now };
      return { entries: updated, sources };
    }

    const entry: LogEntry = {
      id: s.nextId,
      timestamp: now,
      level,
      source,
      message,
      count: 1,
    };
    const entries = [...s.entries, entry].slice(-MAX_ENTRIES);
    return { entries, nextId: s.nextId + 1, sources };
  }),

  updatePerf: (metrics) => set((s) => ({
    perf: { ...s.perf, ...metrics },
  })),

  updateTimings: (timings) => set({ timings }),

  setFilter: (source) => set({ filter: source }),
  toggleProfiler: () => set((s) => ({ profilerVisible: !s.profilerVisible })),
  toggle: () => set((s) => ({ visible: !s.visible })),
  clear: () => set({ entries: [], nextId: 1 }),
}));

// ── Frame timing collector ──
// Systems call frameTiming.begin/end each frame. PerfMonitor snapshots 1x/sec.

const _starts: Record<string, number> = {};
const _accum: Record<string, number> = {};

export const frameTiming = {
  /** Reset accumulators at start of each frame — call once in useFrame before any begin/end */
  resetFrame(): void {
    for (const key in _accum) {
      _accum[key] = 0;
    }
  },
  begin(system: string): void {
    _starts[system] = performance.now();
  },
  end(system: string): void {
    const start = _starts[system];
    if (start !== undefined) {
      // Accumulate: physics substepping calls begin/end multiple times per frame
      _accum[system] = (_accum[system] ?? 0) + (performance.now() - start);
    }
  },
  /** Called by PerfMonitor once per second — returns per-frame snapshot */
  snapshot(): FrameTimings {
    return { ..._accum };
  },
};

// ── Batched convenience API ──
// Queues log entries and flushes to Zustand at max LOG_FLUSH_HZ to prevent
// store spam when errors fire at 128Hz physics tick rate.

const LOG_FLUSH_INTERVAL_MS = 100; // 10Hz max store updates

interface QueuedLog {
  level: LogLevel;
  source: string;
  message: string;
}

const _logQueue: QueuedLog[] = [];
let _flushScheduled = false;

function _flushLogQueue(): void {
  _flushScheduled = false;
  if (_logQueue.length === 0) return;

  // Single set() call for all queued entries — avoids N separate Zustand updates
  useDevLogStore.setState((s) => {
    // Copy once upfront to avoid O(N²) spreading per queue item
    const entries = [...s.entries];
    let nextId = s.nextId;
    let sources = s.sources;
    const now = performance.now();

    for (let i = 0; i < _logQueue.length; i++) {
      const q = _logQueue[i];

      if (!sources.includes(q.source)) {
        sources = [...sources, q.source];
      }

      // Accumulate duplicate messages
      const last = entries.length > 0 ? entries[entries.length - 1] : null;
      if (
        last &&
        last.level === q.level &&
        last.source === q.source &&
        last.message === q.message &&
        (now - last.timestamp) < ACCUMULATE_WINDOW_MS
      ) {
        entries[entries.length - 1] = { ...last, count: last.count + 1, timestamp: now };
        continue;
      }

      entries.push({
        id: nextId++,
        timestamp: now,
        level: q.level,
        source: q.source,
        message: q.message,
        count: 1,
      });
    }

    _logQueue.length = 0;
    return {
      entries: entries.slice(-MAX_ENTRIES),
      nextId,
      sources,
    };
  });
}

function _queueLog(level: LogLevel, source: string, message: string): void {
  _logQueue.push({ level, source, message });
  if (!_flushScheduled) {
    _flushScheduled = true;
    setTimeout(_flushLogQueue, LOG_FLUSH_INTERVAL_MS);
  }
}

export const devLog = {
  info: (source: string, message: string) => _queueLog('info', source, message),
  success: (source: string, message: string) => _queueLog('success', source, message),
  warn: (source: string, message: string) => _queueLog('warn', source, message),
  error: (source: string, message: string) => _queueLog('error', source, message),
  perf: (source: string, message: string) => _queueLog('perf', source, message),
};

// ── Global error capture → devLog ──

let _errorCaptureInstalled = false;

/** Call once at app startup to route all unhandled errors/rejections to devLog */
export function installErrorCapture(): void {
  if (_errorCaptureInstalled) return;
  _errorCaptureInstalled = true;

  window.addEventListener('error', (e) => {
    const file = e.filename ? e.filename.split('/').pop() : 'unknown';
    const loc = e.lineno ? `:${e.lineno}` : '';
    devLog.error('Runtime', `${e.message} (${file}${loc})`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
    devLog.error('Promise', msg);
  });

  // Intercept console.warn and console.error → devLog
  const origWarn = console.warn;
  const origError = console.error;

  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args);
    devLog.warn('Console', args.map(String).join(' '));
  };

  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    devLog.error('Console', args.map(String).join(' '));
  };
}
