/**
 * Killstreak & multikill popup — shows centered text announcements ("Double Kill", "KILLSTREAK x5")
 * with scale-in animation and auto-fade. Uses direct DOM manipulation for animation.
 * Props-injected, no store reads.
 * Depends on: nothing (standalone engine component)
 * Used by: game KillstreakPopup wrapper (HudOverlay)
 */
import { useEffect, useRef } from 'react';

export interface MultikillEvent {
  count: number;       // 2 = double, 3 = triple, etc.
  timestamp: number;   // performance.now()
}

export interface KillstreakPopupProps {
  /** Current killstreak count (0 = hidden) */
  killStreak: number;
  /** Timestamp of last kill (performance.now()) */
  lastKillTime: number;
  /** Current multikill (set when count >= 2) */
  multiKill: MultikillEvent | null;
  /** Seconds before killstreak fades (default: 3) */
  streakFadeDelay?: number;
  /** Seconds before multikill fades (default: 2) */
  multiFadeDelay?: number;
}

const MULTIKILL_LABELS: Record<number, string> = {
  2: 'DOUBLE KILL',
  3: 'TRIPLE KILL',
  4: 'QUAD KILL',
  5: 'RAMPAGE',
};

const STREAK_THRESHOLDS = [5, 10, 15, 20, 25] as const;

const DEFAULTS = {
  STREAK_FADE_DELAY: 3,
  MULTI_FADE_DELAY: 2,
  FADE_DURATION: 0.5,
} as const;

function getMultikillLabel(count: number): string {
  return MULTIKILL_LABELS[count] ?? `${count}x KILL`;
}

function getStreakColor(streak: number): string {
  if (streak >= 20) return '#ff2222';
  if (streak >= 15) return '#ff6622';
  if (streak >= 10) return '#ffaa00';
  if (streak >= 5) return '#ffdd00';
  return '#ffffff';
}

export function KillstreakPopup({
  killStreak,
  lastKillTime,
  multiKill,
  streakFadeDelay,
  multiFadeDelay,
}: KillstreakPopupProps) {
  const streakDelay = streakFadeDelay ?? DEFAULTS.STREAK_FADE_DELAY;
  const multiDelay = multiFadeDelay ?? DEFAULTS.MULTI_FADE_DELAY;

  // ── Killstreak display (top-right, shows at threshold milestones) ──
  const streakRef = useRef<HTMLDivElement>(null);
  const streakTextRef = useRef<HTMLDivElement>(null);
  const prevStreakRef = useRef(0);

  // ── Multikill display (center screen, large text) ──
  const multiRef = useRef<HTMLDivElement>(null);
  const multiTextRef = useRef<HTMLDivElement>(null);
  const prevMultiCountRef = useRef(0);

  // Killstreak milestone animation
  useEffect(() => {
    const el = streakRef.current;
    const textEl = streakTextRef.current;
    if (!el || !textEl) return;

    const isAtThreshold = STREAK_THRESHOLDS.some((t) => killStreak === t);
    const justIncreased = killStreak > prevStreakRef.current;
    prevStreakRef.current = killStreak;

    if (!isAtThreshold || !justIncreased || killStreak < 5) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';
    el.style.opacity = '1';
    textEl.style.transform = 'scale(1.4)';
    const color = getStreakColor(killStreak);
    textEl.style.color = color;
    textEl.style.textShadow = `0 0 12px ${color}80, 0 0 24px ${color}40`;

    const scaleTimer = setTimeout(() => {
      if (textEl) textEl.style.transform = 'scale(1)';
    }, 150);

    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - lastKillTime) / 1000;
      if (elapsed < streakDelay) {
        el.style.opacity = '1';
      } else {
        const fade = Math.min((elapsed - streakDelay) / DEFAULTS.FADE_DURATION, 1);
        el.style.opacity = String(1 - fade);
        if (fade >= 1) { el.style.display = 'none'; return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      clearTimeout(scaleTimer);
      cancelAnimationFrame(raf);
    };
  }, [killStreak, lastKillTime, streakDelay]);

  // Multikill animation
  useEffect(() => {
    const el = multiRef.current;
    const textEl = multiTextRef.current;
    if (!el || !textEl || !multiKill || multiKill.count < 2) {
      if (el) el.style.display = 'none';
      prevMultiCountRef.current = 0;
      return;
    }

    const justTriggered = multiKill.count !== prevMultiCountRef.current;
    prevMultiCountRef.current = multiKill.count;
    if (!justTriggered) return;

    el.style.display = '';
    el.style.opacity = '1';
    textEl.textContent = getMultikillLabel(multiKill.count);
    textEl.style.transform = 'scale(1.6)';
    textEl.style.color = multiKill.count >= 4 ? '#ff4444' : '#ffaa00';

    const scaleTimer = setTimeout(() => {
      if (textEl) textEl.style.transform = 'scale(1)';
    }, 200);

    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - multiKill.timestamp) / 1000;
      if (elapsed < multiDelay) {
        el.style.opacity = '1';
      } else {
        const fade = Math.min((elapsed - multiDelay) / DEFAULTS.FADE_DURATION, 1);
        el.style.opacity = String(1 - fade);
        if (fade >= 1) { el.style.display = 'none'; return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      clearTimeout(scaleTimer);
      cancelAnimationFrame(raf);
    };
  }, [multiKill, multiDelay]);

  return (
    <>
      {/* Killstreak milestone — top-right under kill feed */}
      <div
        ref={streakRef}
        className="absolute top-24 right-4 pointer-events-none text-right"
        style={{ display: 'none' }}
      >
        <div
          ref={streakTextRef}
          className="font-bold text-sm tracking-widest"
          style={{ transition: 'transform 0.15s ease-out' }}
        >
          KILLSTREAK x{killStreak}
        </div>
      </div>

      {/* Multikill popup — center screen */}
      <div
        ref={multiRef}
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center"
        style={{ top: '28%', display: 'none' }}
      >
        <div
          ref={multiTextRef}
          className="font-black text-2xl tracking-[0.2em] uppercase"
          style={{
            textShadow: '0 0 16px rgba(255, 170, 0, 0.6), 0 0 32px rgba(255, 170, 0, 0.3)',
            transition: 'transform 0.2s ease-out',
          }}
        />
      </div>
    </>
  );
}
