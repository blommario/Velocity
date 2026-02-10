/**
 * Inline CSS styles for DevLogPanel and its sub-components. Uses inline
 * styles to avoid Tailwind overflow/scrollbar issues in the overlay panel.
 *
 * Depends on: none
 * Used by: DevLogPanel, PerfBar, ProfilerBar, FilterBar, LogRow
 */
import type { LogLevel } from '../devLogStore';

export const PANEL = {
  MAX_VISIBLE: 20,
} as const;

export const LEVEL_CONFIG: Record<LogLevel, { icon: string; color: string; bg: string; label: string }> = {
  info:    { icon: '\u25CF', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  label: 'INF' },
  success: { icon: '\u2714', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  label: 'OK'  },
  warn:    { icon: '\u26A0', color: '#facc15', bg: 'rgba(250,204,21,0.08)',  label: 'WRN' },
  error:   { icon: '\u2716', color: '#f87171', bg: 'rgba(248,113,113,0.08)', label: 'ERR' },
  perf:    { icon: '\u23F1', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  label: 'PRF' },
} as const;

export const TIMING_COLORS: Record<string, string> = {
  Physics: '#f97316',
  Render: '#60a5fa',
  Explosions: '#f87171',
  Particles: '#a78bfa',
};

export const DEFAULT_TIMING_COLOR = '#6b7280';

export function getTimingColor(system: string): string {
  return TIMING_COLORS[system] ?? DEFAULT_TIMING_COLOR;
}

export const styles = {
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
