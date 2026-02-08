import { useEffect, useRef, useCallback } from 'react';
import { useDevLogStore, type LogLevel, type PerfMetrics } from '../../stores/devLogStore';

const LOG_COLORS: Record<LogLevel, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  perf: 'text-cyan-400',
} as const;

const LOG_ICONS: Record<LogLevel, string> = {
  info: '\u25CF',
  success: '\u2714',
  warn: '\u26A0',
  error: '\u2716',
  perf: '\u23F1',
} as const;

const PANEL = {
  MAX_VISIBLE: 24,
  WIDTH: 'w-96',
} as const;

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(2, '0')}`;
}

function getFpsColor(fps: number): string {
  if (fps >= 55) return 'text-green-400';
  if (fps >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

function getFrametimeColor(ft: number): string {
  if (ft <= 18) return 'text-green-400';
  if (ft <= 33) return 'text-yellow-400';
  return 'text-red-400';
}

function formatMemory(mb: number): string {
  return `${mb}MB`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function PerfBar({ perf }: { perf: PerfMetrics }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-black/80 border-b border-white/10 font-mono text-[10px]">
      {/* FPS */}
      <span className={getFpsColor(perf.fps)}>
        {perf.fps} FPS
      </span>
      {/* Frametime */}
      <span className={getFrametimeColor(perf.frametime)}>
        {perf.frametime}ms
      </span>
      {/* Max frametime */}
      <span className={`${getFrametimeColor(perf.frametimeMax)} opacity-60`}>
        max {perf.frametimeMax}ms
      </span>
      {/* Separator */}
      <span className="text-white/20">|</span>
      {/* Memory */}
      <span className="text-purple-400">
        {formatMemory(perf.memoryMB)}
      </span>
      {/* Draw calls */}
      <span className="text-white/40">
        DC:{perf.drawCalls}
      </span>
      {/* Triangles */}
      <span className="text-white/40">
        Tri:{formatCount(perf.triangles)}
      </span>
      {/* Geometries/Textures */}
      <span className="text-white/30">
        G:{perf.geometries} T:{perf.textures}
      </span>
    </div>
  );
}

function FilterBar({ sources, activeFilter, onFilter }: {
  sources: string[];
  activeFilter: string | null;
  onFilter: (s: string | null) => void;
}) {
  // Only show filter bar when there are sources
  if (sources.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-black/70 border-b border-white/10 overflow-x-auto">
      <button
        onClick={() => onFilter(null)}
        className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
          activeFilter === null
            ? 'bg-white/20 text-white/90'
            : 'text-white/40 hover:text-white/70'
        }`}
      >
        ALL
      </button>
      {sources.map((src) => (
        <button
          key={src}
          onClick={() => onFilter(activeFilter === src ? null : src)}
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
            activeFilter === src
              ? 'bg-white/20 text-white/90'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {src}
        </button>
      ))}
    </div>
  );
}

export function DevLogPanel() {
  const entries = useDevLogStore((s) => s.entries);
  const visible = useDevLogStore((s) => s.visible);
  const filter = useDevLogStore((s) => s.filter);
  const perf = useDevLogStore((s) => s.perf);
  const sources = useDevLogStore((s) => s.sources);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setFilter = useCallback((s: string | null) => {
    useDevLogStore.getState().setFilter(s);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (!visible) return null;

  const filtered = filter
    ? entries.filter((e) => e.source === filter)
    : entries;
  const visibleEntries = filtered.slice(-PANEL.MAX_VISIBLE);

  // Count errors/warnings for header badge
  const errorCount = entries.filter((e) => e.level === 'error').length;
  const warnCount = entries.filter((e) => e.level === 'warn').length;

  return (
    <div
      className={`absolute top-2 right-2 ${PANEL.WIDTH} max-h-[60vh] flex flex-col pointer-events-auto`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-white/70 tracking-wider uppercase">
            Dev Log
          </span>
          {errorCount > 0 && (
            <span className="text-[9px] font-mono bg-red-500/30 text-red-400 px-1.5 py-0.5 rounded">
              {errorCount} err
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[9px] font-mono bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
              {warnCount} warn
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => useDevLogStore.getState().clear()}
            className="text-xs text-white/40 hover:text-white/80 font-mono"
          >
            CLR
          </button>
          <button
            onClick={() => useDevLogStore.getState().toggle()}
            className="text-xs text-white/40 hover:text-white/80 font-mono"
          >
            X
          </button>
        </div>
      </div>

      {/* Perf bar */}
      <PerfBar perf={perf} />

      {/* Filter bar */}
      <FilterBar sources={sources} activeFilter={filter} onFilter={setFilter} />

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-sm border-x border-b border-white/10 rounded-b-lg px-2 py-1 space-y-0.5"
      >
        {visibleEntries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-1.5 font-mono text-[10px] leading-tight">
            <span className="text-white/30 shrink-0">
              {formatTimestamp(entry.timestamp)}
            </span>
            <span className={`shrink-0 ${LOG_COLORS[entry.level]}`}>
              {LOG_ICONS[entry.level]}
            </span>
            <span className="text-white/50 shrink-0">
              [{entry.source}]
            </span>
            <span className={`${LOG_COLORS[entry.level]} opacity-80 break-all`}>
              {entry.message}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-white/20 text-[10px] font-mono text-center py-2">
            {filter ? `No "${filter}" entries` : 'Waiting for events...'}
          </div>
        )}
      </div>
    </div>
  );
}
