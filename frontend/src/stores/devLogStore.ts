import { create } from 'zustand';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'perf';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
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

const MAX_ENTRIES = 200;

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
  /** Collected unique source names for filter dropdown */
  sources: string[];
  push: (level: LogLevel, source: string, message: string) => void;
  updatePerf: (metrics: Partial<PerfMetrics>) => void;
  setFilter: (source: string | null) => void;
  toggle: () => void;
  clear: () => void;
}

export const useDevLogStore = create<DevLogState>((set) => ({
  entries: [],
  nextId: 1,
  visible: true,
  filter: null,
  perf: PERF_DEFAULTS,
  sources: [],

  push: (level, source, message) => set((s) => {
    const entry: LogEntry = {
      id: s.nextId,
      timestamp: performance.now(),
      level,
      source,
      message,
    };
    const entries = [...s.entries, entry].slice(-MAX_ENTRIES);
    // Track unique sources
    const sources = s.sources.includes(source) ? s.sources : [...s.sources, source];
    return { entries, nextId: s.nextId + 1, sources };
  }),

  updatePerf: (metrics) => set((s) => ({
    perf: { ...s.perf, ...metrics },
  })),

  setFilter: (source) => set({ filter: source }),
  toggle: () => set((s) => ({ visible: !s.visible })),
  clear: () => set({ entries: [], nextId: 1 }),
}));

// ── Convenience API (import { devLog } from 'stores/devLogStore') ──

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
