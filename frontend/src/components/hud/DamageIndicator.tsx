import { useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useCombatStore } from '../../stores/combatStore';

const INDICATOR = {
  DURATION: 0.8,
  SIZE: 120,
  OPACITY_MAX: 0.7,
} as const;

interface DamageFlash {
  id: number;
  opacity: number;
}

/**
 * Full-screen directional damage indicator.
 * Shows red flashes at screen edges when taking damage.
 * Since we primarily have self-damage (rocket/grenade), show omnidirectional vignette.
 */
export function DamageIndicator() {
  const lastHealthRef = useRef(100);
  const flashRef = useRef<DamageFlash | null>(null);
  const nextIdRef = useRef(0);
  const frameCountRef = useRef(0);

  // Check every few frames to avoid expensive React state updates
  const health = useCombatStore((s) => s.health);

  if (health < lastHealthRef.current) {
    // Damage taken!
    const dmgAmount = lastHealthRef.current - health;
    const intensity = Math.min(dmgAmount / 50, 1);
    flashRef.current = {
      id: nextIdRef.current++,
      opacity: INDICATOR.OPACITY_MAX * intensity,
    };
  }
  lastHealthRef.current = health;

  const flash = flashRef.current;
  if (!flash || flash.opacity <= 0.01) return null;

  // Decay via CSS animation instead of per-frame state updates
  return (
    <div
      key={flash.id}
      className="absolute inset-0 pointer-events-none animate-damage-flash"
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(220, 30, 30, ${flash.opacity}) 100%)`,
        animation: `damage-flash ${INDICATOR.DURATION}s ease-out forwards`,
      }}
    />
  );
}
