/**
 * Developer log overlay panel — shows real-time perf metrics, frame profiler,
 * filtered log entries, and clipboard export. Toggled via devLogStore.
 *
 * Depends on: devLogStore (entries, perf, filter, visibility)
 * Used by: GameCanvas (HUD overlay)
 */
import { useCallback, useMemo } from 'react';
import { useDevLogStore, type LogEntry } from './devLogStore';
import { styles, PANEL } from './devlog/devLogStyles';
import { formatEntryForCopy } from './devlog/devLogFormatters';
import { PerfBar } from './devlog/PerfBar';
import { ProfilerBar } from './devlog/ProfilerBar';
import { FilterBar } from './devlog/FilterBar';
import { LogRow } from './devlog/LogRow';

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
    navigator.clipboard.writeText(formatEntryForCopy(entry));
  }, []);

  const handleCopyAll = useCallback(() => {
    const state = useDevLogStore.getState();
    const all = state.filter
      ? state.entries.filter((e) => e.source === state.filter)
      : state.entries;
    navigator.clipboard.writeText(all.map(formatEntryForCopy).join('\n'));
  }, []);

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
            <span style={styles.badge('#f87171', 'rgba(248,113,113,0.15)')}>{errorCount} err</span>
          )}
          {warnCount > 0 && (
            <span style={styles.badge('#facc15', 'rgba(250,204,21,0.12)')}>{warnCount} warn</span>
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
            {'\u2715'}
          </button>
        </div>
      </div>

      <PerfBar perf={perf} />
      {profilerVisible && <ProfilerBar timings={timings} frametime={perf.frametime} />}
      <FilterBar sources={sources} activeFilter={filter} onFilter={setFilter} />

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
