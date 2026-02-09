import { useState, useEffect } from 'react';
import { audioManager, SOUNDS } from '../../engine/audio/AudioManager';

const HITMARKER = {
  DURATION: 0.3,     // seconds
  SIZE: 16,          // pixels from center
  THICKNESS: 2,      // line width
  GAP: 6,            // gap from center
} as const;

interface HitMark {
  id: number;
  timestamp: number;
  isKill: boolean;
}

// Imperative API for physics tick (no Zustand overhead at 128Hz)
let _nextId = 0;
const _pendingHits: HitMark[] = [];

export function pushHitMarker(isKill = false): void {
  _pendingHits.push({ id: _nextId++, timestamp: Date.now(), isKill });
  audioManager.play(SOUNDS.HIT_MARKER, 0.08);
}

export function HitMarker() {
  const [marks, setMarks] = useState<HitMark[]>([]);

  // Poll for pending hits (60Hz via requestAnimationFrame)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const hasPending = _pendingHits.length > 0;

      setMarks((prev) => {
        if (prev.length === 0 && !hasPending) return prev;

        const cutoff = now - HITMARKER.DURATION * 1000;
        const next = prev.filter((m) => m.timestamp > cutoff);
        if (hasPending) next.push(..._pendingHits.splice(0));

        // Skip re-render if nothing changed
        if (!hasPending && next.length === prev.length) return prev;
        return next;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (marks.length === 0) return null;

  const latest = marks[marks.length - 1];
  const age = (Date.now() - latest.timestamp) / 1000;
  const progress = Math.min(age / HITMARKER.DURATION, 1);
  const opacity = 1 - progress;
  const scale = 1 + progress * 0.3;
  const color = latest.isKill ? '#ff4444' : '#ffffff';

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <svg
        width={HITMARKER.SIZE * 4}
        height={HITMARKER.SIZE * 4}
        viewBox={`0 0 ${HITMARKER.SIZE * 4} ${HITMARKER.SIZE * 4}`}
        style={{
          opacity,
          transform: `scale(${scale})`,
          transition: 'none',
        }}
      >
        {/* Four diagonal lines forming X */}
        {[
          [-1, -1], [1, -1], [1, 1], [-1, 1],
        ].map(([dx, dy], i) => {
          const cx = HITMARKER.SIZE * 2;
          const cy = HITMARKER.SIZE * 2;
          return (
            <line
              key={i}
              x1={cx + dx * HITMARKER.GAP}
              y1={cy + dy * HITMARKER.GAP}
              x2={cx + dx * HITMARKER.SIZE}
              y2={cy + dy * HITMARKER.SIZE}
              stroke={color}
              strokeWidth={HITMARKER.THICKNESS}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}
