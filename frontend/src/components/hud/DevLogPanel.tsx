import { useEffect, useRef } from 'react';
import { useDevLogStore, type LogLevel } from '../../stores/devLogStore';

const LOG_COLORS: Record<LogLevel, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
} as const;

const LOG_ICONS: Record<LogLevel, string> = {
  info: '\u25CF',
  success: '\u2714',
  warn: '\u26A0',
  error: '\u2716',
} as const;

const PANEL = {
  MAX_VISIBLE: 20,
  WIDTH: 'w-80',
} as const;

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(2, '0')}`;
}

export function DevLogPanel() {
  const entries = useDevLogStore((s) => s.entries);
  const visible = useDevLogStore((s) => s.visible);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (!visible) return null;

  const visibleEntries = entries.slice(-PANEL.MAX_VISIBLE);

  return (
    <div
      className={`absolute top-2 right-2 ${PANEL.WIDTH} max-h-[50vh] flex flex-col pointer-events-auto`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-t-lg">
        <span className="text-xs font-mono font-bold text-white/70 tracking-wider uppercase">
          Dev Log
        </span>
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
            <span className={`${LOG_COLORS[entry.level]} opacity-80`}>
              {entry.message}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-white/20 text-[10px] font-mono text-center py-2">
            Waiting for events...
          </div>
        )}
      </div>
    </div>
  );
}
