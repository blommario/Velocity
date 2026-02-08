import { useCallback, useMemo } from 'react';
import { useDevLogStore, type LogLevel, type LogEntry, type PerfMetrics, type FrameTimings } from './devLogStore';

// ── Constants ──

const PANEL = {
  MAX_VISIBLE: 20,
} as const;

const LEVEL_CONFIG: Record<LogLevel, { icon: string; color: string; bg: string; label: string }> = {
  info:    { icon: '\u25CF', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  label: 'INF' },
  success: { icon: '\u2714', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  label: 'OK'  },
  warn:    { icon: '\u26A0', color: '#facc15', bg: 'rgba(250,204,21,0.08)',  label: 'WRN' },
  error:   { icon: '\u2716', color: '#f87171', bg: 'rgba(248,113,113,0.08)', label: 'ERR' },
  perf:    { icon: '\u23F1', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  label: 'PRF' },
} as const;

// ── Formatters ──

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(2, '0')}`;
}

function getFpsColor(fps: number): string {
  if (fps >= 55) return '#4ade80';
  if (fps >= 30) return '#facc15';
  return '#f87171';
}

function getFrametimeColor(ft: number): string {
  if (ft <= 18) return '#4ade80';
  if (ft <= 33) return '#facc15';
  return '#f87171';
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatEntryForCopy(entry: LogEntry): string {
  const ts = formatTimestamp(entry.timestamp);
  const lvl = LEVEL_CONFIG[entry.level].label;
  const count = entry.count > 1 ? ` (x${entry.count})` : '';
  return `[${ts}] ${lvl} [${entry.source}] ${entry.message}${count}`;
}

// ── Inline styles (no scrollbar, no Tailwind overflow issues) ──

const styles = {
  panel: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 420,
    maxHeight: '55vh',
    display: 'flex',
    flexDirection: 'column' as const,
    pointerEvents: 'auto' as const,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace",
    fontSize: 10,
    lineHeight: '14px',
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.07)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)',
    userSelect: 'text' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 10px',
    background: 'rgba(17,17,23,0.95)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  badge: (color: string, bg: string) => ({
    fontSize: 9,
    fontWeight: 600,
    color,
    background: bg,
    padding: '1px 5px',
    borderRadius: 3,
  }),
  headerBtn: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 3,
    fontFamily: 'inherit',
  },
  perfBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 10px',
    background: 'rgba(10,10,16,0.95)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 10,
  },
  perfSep: {
    color: 'rgba(255,255,255,0.1)',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '3px 8px',
    background: 'rgba(13,13,19,0.95)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    flexWrap: 'wrap' as const,
  },
  filterBtn: (active: boolean) => ({
    fontSize: 9,
    fontWeight: active ? 600 : 400,
    color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '1px 6px',
    borderRadius: 3,
    fontFamily: 'inherit',
  }),
  logArea: {
    flex: 1,
    overflow: 'hidden',
    background: 'rgba(10,10,16,0.92)',
    padding: '4px 0',
  },
  row: (bg: string) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '1px 10px',
    background: bg,
    cursor: 'pointer',
  }),
  rowTs: {
    color: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
    width: 56,
  },
  rowIcon: (color: string) => ({
    color,
    flexShrink: 0,
    width: 12,
    textAlign: 'center' as const,
  }),
  rowSource: {
    color: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  rowMsg: (color: string) => ({
    color,
    opacity: 0.85,
    flex: 1,
    wordBreak: 'break-word' as const,
  }),
  rowCount: (color: string) => ({
    color,
    opacity: 0.6,
    flexShrink: 0,
    fontWeight: 700,
    fontSize: 9,
    background: `${color}15`,
    padding: '0 4px',
    borderRadius: 3,
    marginLeft: 4,
  }),
  empty: {
    color: 'rgba(255,255,255,0.15)',
    textAlign: 'center' as const,
    padding: '12px 0',
    fontSize: 10,
  },
} as const;

// ── Sub-components ──

function PerfBar({ perf }: { perf: PerfMetrics }) {
  return (
    <div style={styles.perfBar}>
      <span style={{ color: getFpsColor(perf.fps) }}>{perf.fps} FPS</span>
      <span style={{ color: getFrametimeColor(perf.frametime) }}>{perf.frametime}ms</span>
      <span style={{ color: getFrametimeColor(perf.frametimeMax), opacity: 0.5 }}>
        pk {perf.frametimeMax}ms
      </span>
      <span style={styles.perfSep}>|</span>
      <span style={{ color: '#c084fc' }}>{perf.memoryMB}MB</span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>
        DC:{perf.drawCalls}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>
        Tri:{formatCount(perf.triangles)}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.2)' }}>
        G:{perf.geometries} T:{perf.textures}
      </span>
    </div>
  );
}

const TIMING_COLORS: Record<string, string> = {
  Physics: '#f97316',
  Render: '#60a5fa',
  Explosions: '#f87171',
  Particles: '#a78bfa',
};

const DEFAULT_TIMING_COLOR = '#6b7280';

function getTimingColor(system: string): string {
  return TIMING_COLORS[system] ?? DEFAULT_TIMING_COLOR;
}

function ProfilerBar({ timings, frametime }: { timings: FrameTimings; frametime: number }) {
  const entries = Object.entries(timings).filter(([, ms]) => ms > 0);
  if (entries.length === 0) return null;

  // Sort by ms descending
  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, ms]) => sum + ms, 0);

  return (
    <div style={{
      padding: '4px 10px',
      background: 'rgba(10,10,16,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {/* Stacked bar */}
      <div style={{
        display: 'flex',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)',
        marginBottom: 3,
      }}>
        {entries.map(([system, ms]) => (
          <div
            key={system}
            style={{
              width: `${Math.max((ms / Math.max(frametime, 1)) * 100, 1)}%`,
              background: getTimingColor(system),
              opacity: 0.8,
            }}
            title={`${system}: ${ms.toFixed(2)}ms`}
          />
        ))}
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entries.map(([system, ms]) => (
          <span
            key={system}
            style={{
              fontSize: 9,
              color: getTimingColor(system),
              cursor: 'pointer',
            }}
            onClick={() => {
              const text = `${system}: ${ms.toFixed(2)}ms`;
              navigator.clipboard.writeText(text);
            }}
            title="Click to copy"
          >
            {system}:{ms.toFixed(1)}ms
          </span>
        ))}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
          total:{total.toFixed(1)}ms
        </span>
      </div>
    </div>
  );
}

function FilterBar({ sources, activeFilter, onFilter }: {
  sources: string[];
  activeFilter: string | null;
  onFilter: (s: string | null) => void;
}) {
  if (sources.length <= 1) return null;
  return (
    <div style={styles.filterBar}>
      <button
        style={styles.filterBtn(activeFilter === null)}
        onClick={() => onFilter(null)}
      >
        ALL
      </button>
      {sources.map((src) => (
        <button
          key={src}
          style={styles.filterBtn(activeFilter === src)}
          onClick={() => onFilter(activeFilter === src ? null : src)}
        >
          {src}
        </button>
      ))}
    </div>
  );
}

function LogRow({ entry, onClick }: { entry: LogEntry; onClick: (e: LogEntry) => void }) {
  const cfg = LEVEL_CONFIG[entry.level];
  return (
    <div
      style={styles.row(entry.count > 1 ? cfg.bg : 'transparent')}
      onClick={() => onClick(entry)}
      title="Click to copy"
    >
      <span style={styles.rowTs}>{formatTimestamp(entry.timestamp)}</span>
      <span style={styles.rowIcon(cfg.color)}>{cfg.icon}</span>
      <span style={styles.rowSource}>[{entry.source}]</span>
      <span style={styles.rowMsg(cfg.color)}>{entry.message}</span>
      {entry.count > 1 && (
        <span style={styles.rowCount(cfg.color)}>x{entry.count}</span>
      )}
    </div>
  );
}

// ── Main component ──

export function DevLogPanel() {
  const entries = useDevLogStore((s) => s.entries);
  const visible = useDevLogStore((s) => s.visible);
  const filter = useDevLogStore((s) => s.filter);
  const perf = useDevLogStore((s) => s.perf);
  const timings = useDevLogStore((s) => s.timings);
  const profilerVisible = useDevLogStore((s) => s.profilerVisible);
  const sources = useDevLogStore((s) => s.sources);

  const setFilter = useCallback((s: string | null) => {
    useDevLogStore.getState().setFilter(s);
  }, []);

  const handleRowClick = useCallback((entry: LogEntry) => {
    const text = formatEntryForCopy(entry);
    navigator.clipboard.writeText(text);
  }, []);

  const handleCopyAll = useCallback(() => {
    const state = useDevLogStore.getState();
    const all = state.filter
      ? state.entries.filter((e) => e.source === state.filter)
      : state.entries;
    const text = all.map(formatEntryForCopy).join('\n');
    navigator.clipboard.writeText(text);
  }, []);

  // Compute visible entries + error/warn totals
  const { visibleEntries, errorCount, warnCount } = useMemo(() => {
    const filtered = filter ? entries.filter((e) => e.source === filter) : entries;
    return {
      visibleEntries: filtered.slice(-PANEL.MAX_VISIBLE),
      errorCount: entries.reduce((sum, e) => sum + (e.level === 'error' ? e.count : 0), 0),
      warnCount: entries.reduce((sum, e) => sum + (e.level === 'warn' ? e.count : 0), 0),
    };
  }, [entries, filter]);

  if (!visible) return null;

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>Dev Log</span>
          {errorCount > 0 && (
            <span style={styles.badge('#f87171', 'rgba(248,113,113,0.15)')}>
              {errorCount} err
            </span>
          )}
          {warnCount > 0 && (
            <span style={styles.badge('#facc15', 'rgba(250,204,21,0.12)')}>
              {warnCount} warn
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{ ...styles.headerBtn, color: profilerVisible ? '#22d3ee' : 'rgba(255,255,255,0.3)' }}
            onClick={() => useDevLogStore.getState().toggleProfiler()}
            title="Toggle frame profiler"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = profilerVisible ? '#22d3ee' : 'rgba(255,255,255,0.3)'; }}
          >
            PROF
          </button>
          <button
            style={styles.headerBtn}
            onClick={handleCopyAll}
            title="Copy all to clipboard"
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
          >
            CPY
          </button>
          <button
            style={styles.headerBtn}
            onClick={() => useDevLogStore.getState().clear()}
            title="Clear log"
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
          >
            CLR
          </button>
          <button
            style={styles.headerBtn}
            onClick={() => useDevLogStore.getState().toggle()}
            title="Close panel"
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
          >
            \u2715
          </button>
        </div>
      </div>

      {/* Perf bar */}
      <PerfBar perf={perf} />

      {/* Frame profiler — togglable */}
      {profilerVisible && <ProfilerBar timings={timings} frametime={perf.frametime} />}

      {/* Filter bar */}
      <FilterBar sources={sources} activeFilter={filter} onFilter={setFilter} />

      {/* Log entries — fixed height, no scroll, shows latest N */}
      <div style={styles.logArea}>
        {visibleEntries.length > 0 ? (
          visibleEntries.map((entry) => (
            <LogRow key={entry.id} entry={entry} onClick={handleRowClick} />
          ))
        ) : (
          <div style={styles.empty}>
            {filter ? `No "${filter}" entries` : 'Waiting for events\u2026'}
          </div>
        )}
      </div>
    </div>
  );
}
