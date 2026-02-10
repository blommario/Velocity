/**
 * Critical hit flash overlay — brief full-screen red flash when a single hit deals massive damage.
 * Triggers on `lastCriticalTime` prop change. Uses direct DOM manipulation to avoid React re-renders during animation.
 * Depends on: nothing (standalone engine component)
 * Used by: game CriticalHitFlash wrapper (HudOverlay)
 */
import { useEffect, useRef } from 'react';

export interface CriticalHitFlashProps {
  /** Timestamp (ms via performance.now()) of last critical hit. 0 = none. */
  lastCriticalTime: number;
  /** Flash duration in seconds (default: 0.3) */
  duration?: number;
  /** Flash color (default: 'rgba(255, 0, 0, 0.35)') */
  color?: string;
}

const DEFAULTS = {
  DURATION: 0.3,
  COLOR: 'rgba(255, 0, 0, 0.35)',
} as const;

export function CriticalHitFlash({ lastCriticalTime, duration, color }: CriticalHitFlashProps) {
  const dur = duration ?? DEFAULTS.DURATION;
  const flashColor = color ?? DEFAULTS.COLOR;
  const divRef = useRef<HTMLDivElement>(null);
  const prevTimeRef = useRef(0);

  useEffect(() => {
    if (lastCriticalTime <= 0 || lastCriticalTime === prevTimeRef.current) return;
    prevTimeRef.current = lastCriticalTime;

    const el = divRef.current;
    if (!el) return;
    el.style.display = '';

    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - lastCriticalTime) / 1000;
      const progress = Math.min(elapsed / dur, 1);
      el.style.opacity = String(1 - progress);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        el.style.display = 'none';
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lastCriticalTime, dur]);

  return (
    <div
      ref={divRef}
      className="absolute inset-0 pointer-events-none"
      style={{ backgroundColor: flashColor, opacity: 0, display: 'none' }}
    />
  );
}
