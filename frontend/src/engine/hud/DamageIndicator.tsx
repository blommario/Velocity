import { useRef } from 'react';

export interface DamageIndicatorProps {
  /** Current health value (damage detected when it decreases) */
  health: number;
  /** Max health for intensity scaling (default: 100) */
  maxHealth?: number;
  /** Damage amount for full intensity (default: 50) */
  fullIntensityDamage?: number;
  /** Max opacity (default: 0.7) */
  maxOpacity?: number;
  /** Flash duration in seconds (default: 0.8) */
  duration?: number;
  /** Vignette color (default: 'rgba(220, 30, 30, 1)') */
  color?: string;
}

export function DamageIndicator({
  health,
  fullIntensityDamage = 50,
  maxOpacity = 0.7,
  duration = 0.8,
  color,
}: DamageIndicatorProps) {
  const lastHealthRef = useRef(health);
  const flashRef = useRef<{ id: number; opacity: number } | null>(null);
  const nextIdRef = useRef(0);

  if (health < lastHealthRef.current) {
    const dmgAmount = lastHealthRef.current - health;
    const intensity = Math.min(dmgAmount / fullIntensityDamage, 1);
    flashRef.current = {
      id: nextIdRef.current++,
      opacity: maxOpacity * intensity,
    };
  }
  lastHealthRef.current = health;

  const flash = flashRef.current;
  if (!flash || flash.opacity <= 0.01) return null;

  const r = color ?? 'rgba(220, 30, 30, 1)';
  // Extract rgb values or use default for gradient
  const gradientColor = color
    ? color.replace(/[\d.]+\)$/, `${flash.opacity})`)
    : `rgba(220, 30, 30, ${flash.opacity})`;

  return (
    <div
      key={flash.id}
      className="absolute inset-0 pointer-events-none animate-damage-flash"
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, ${gradientColor} 100%)`,
        animation: `damage-flash ${duration}s ease-out forwards`,
      }}
    />
  );
}
