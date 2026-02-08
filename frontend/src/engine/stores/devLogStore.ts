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
  begin(system: string): void {
    _starts[system] = performance.now();
  },
  end(system: string): void {
    const start = _starts[system];
    if (start !== undefined) {
      _accum[system] = (performance.now() - start);
    }
  },
  /** Called by PerfMonitor once per second — returns snapshot and keeps current values */
  snapshot(): FrameTimings {
    return { ..._accum };
  },
};

// ── Convenience API ──

export const devLog = {
  info: (source: string, message: string) =>
    useDevLogStore.getState().push('info', source, message),
  success: (source: string, message: string) =>
    useDevLogStore.getState().push('success', source, message),
  warn: (source: string, message: string) =>
    useDevLogStore.getState().push('warn', source, message),
  error: (source: string, message: string) =>
    useDevLogStore.getState().push('error', source, message),
  perf: (source: string, message: string) =>
    useDevLogStore.getState().push('perf', source, message),
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
