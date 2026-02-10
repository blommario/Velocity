import { useState, useEffect } from 'react';

export interface HitMarkerConfig {
  duration?: number;
  size?: number;
  thickness?: number;
  gap?: number;
  color?: string;
  killColor?: string;
}

interface HitMark {
  id: number;
  timestamp: number;
  isKill: boolean;
}

const DEFAULTS = {
  DURATION: 0.3,
  SIZE: 16,
  THICKNESS: 2,
  GAP: 6,
} as const;

// Imperative API — module-level queue
let _nextId = 0;
const _pendingHits: HitMark[] = [];

/** Push a hit marker from outside React (e.g. physics tick). Optionally play audio via onHit callback. */
export function pushHitMarker(isKill = false): void {
  _pendingHits.push({ id: _nextId++, timestamp: Date.now(), isKill });
}

export interface HitMarkerProps {
  config?: HitMarkerConfig;
  /** Called on each hit (for audio, etc.) */
  onHit?: (isKill: boolean) => void;
}

export function HitMarker({ config, onHit }: HitMarkerProps) {
  const [marks, setMarks] = useState<HitMark[]>([]);
  const dur = config?.duration ?? DEFAULTS.DURATION;
  const size = config?.size ?? DEFAULTS.SIZE;
  const thickness = config?.thickness ?? DEFAULTS.THICKNESS;
  const gap = config?.gap ?? DEFAULTS.GAP;
  const normalColor = config?.color ?? '#ffffff';
  const killColor = config?.killColor ?? '#ff4444';

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const hasPending = _pendingHits.length > 0;

      if (hasPending && onHit) {
        for (const hit of _pendingHits) onHit(hit.isKill);
      }

      setMarks((prev) => {
        if (prev.length === 0 && !hasPending) return prev;
        const cutoff = now - dur * 1000;
        const next = prev.filter((m) => m.timestamp > cutoff);
        if (hasPending) next.push(..._pendingHits.splice(0));
        if (!hasPending && next.length === prev.length) return prev;
        return next;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dur, onHit]);

  if (marks.length === 0) return null;

  const latest = marks[marks.length - 1];
  const age = (Date.now() - latest.timestamp) / 1000;
  const progress = Math.min(age / dur, 1);
  const opacity = 1 - progress;
  const scale = 1 + progress * 0.3;
  const color = latest.isKill ? killColor : normalColor;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <svg
        width={size * 4}
        height={size * 4}
        viewBox={`0 0 ${size * 4} ${size * 4}`}
        style={{ opacity, transform: `scale(${scale})`, transition: 'none' }}
      >
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy], i) => {
          const cx = size * 2;
          const cy = size * 2;
          return (
            <line
              key={i}
              x1={cx + dx * gap}
              y1={cy + dy * gap}
              x2={cx + dx * size}
              y2={cy + dy * size}
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}
