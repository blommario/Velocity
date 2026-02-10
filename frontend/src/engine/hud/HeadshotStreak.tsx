/**
 * Headshot streak counter — shows "HEADSHOT xN" text above crosshair with auto-fade.
 * Uses direct DOM manipulation for opacity to avoid React re-renders during animation.
 * Props-injected, no store reads.
 * Depends on: nothing (standalone engine component)
 * Used by: game HeadshotStreak wrapper (HudOverlay)
 */
import { useEffect, useRef } from 'react';

export interface HeadshotStreakProps {
  /** Current streak count (0 = hidden) */
  count: number;
  /** Timestamp (ms via performance.now()) of last headshot */
  lastTime: number;
  /** Seconds before fade starts (default: 3) */
  fadeDelay?: number;
  /** Fade duration in seconds (default: 0.5) */
  fadeDuration?: number;
}

const DEFAULTS = {
  FADE_DELAY: 3,
  FADE_DURATION: 0.5,
} as const;

export function HeadshotStreak({ count, lastTime, fadeDelay, fadeDuration }: HeadshotStreakProps) {
  const delay = fadeDelay ?? DEFAULTS.FADE_DELAY;
  const duration = fadeDuration ?? DEFAULTS.FADE_DURATION;
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Pulse animation on count increase — single CSS transition, no rAF
  useEffect(() => {
    if (count > prevCountRef.current && count > 0 && textRef.current) {
      textRef.current.style.transform = 'scale(1.3)';
      const t = setTimeout(() => {
        if (textRef.current) textRef.current.style.transform = 'scale(1)';
      }, 150);
      prevCountRef.current = count;
      return () => clearTimeout(t);
    }
    prevCountRef.current = count;
  }, [count]);

  // Fade logic via rAF with direct DOM manipulation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (count <= 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';

    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - lastTime) / 1000;
      if (elapsed < delay) {
        el.style.opacity = '1';
      } else {
        const fadeProgress = Math.min((elapsed - delay) / duration, 1);
        el.style.opacity = String(1 - fadeProgress);
        if (fadeProgress >= 1) {
          el.style.display = 'none';
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, lastTime, delay, duration]);

  if (count <= 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center"
      style={{ top: '35%', opacity: 0 }}
    >
      <div
        ref={textRef}
        className="font-bold text-sm tracking-widest"
        style={{
          color: '#ff2222',
          textShadow: '0 0 8px rgba(255, 34, 34, 0.6), 0 0 16px rgba(255, 34, 34, 0.3)',
          transition: 'transform 0.15s ease-out',
        }}
      >
        HEADSHOT{count > 1 ? ` x${count}` : ''}
      </div>
    </div>
  );
}
