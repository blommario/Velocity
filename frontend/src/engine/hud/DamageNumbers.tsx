import { useEffect, useRef, useState } from 'react';

export interface DamageNumbersConfig {
  duration?: number;
  driftSpeed?: number;
  spread?: number;
  fontSizeMin?: number;
  fontSizeMax?: number;
  maxItems?: number;
  /** Damage → color mapping. Array of { min, color } checked top-down. */
  colorThresholds?: readonly { min: number; color: string }[];
}

export interface DamageNumbersProps {
  /** Current health — damage detected on decrease */
  health: number;
  config?: DamageNumbersConfig;
}

const DEFAULTS = {
  DURATION: 1.2,
  DRIFT_SPEED: 40,
  SPREAD: 60,
  FONT_SIZE_MIN: 14,
  FONT_SIZE_MAX: 28,
  MAX_ITEMS: 6,
} as const;

const DEFAULT_COLORS: readonly { min: number; color: string }[] = [
  { min: 50, color: '#ff4444' },
  { min: 20, color: '#ffaa22' },
  { min: 0, color: '#ffffff' },
];

interface DamageNum {
  id: number;
  amount: number;
  timestamp: number;
  offsetX: number;
}

let _nextId = 0;

export function DamageNumbers({ health, config }: DamageNumbersProps) {
  const [items, setItems] = useState<DamageNum[]>([]);
  const lastHealthRef = useRef(health);

  const duration = config?.duration ?? DEFAULTS.DURATION;
  const driftSpeed = config?.driftSpeed ?? DEFAULTS.DRIFT_SPEED;
  const spread = config?.spread ?? DEFAULTS.SPREAD;
  const fontMin = config?.fontSizeMin ?? DEFAULTS.FONT_SIZE_MIN;
  const fontMax = config?.fontSizeMax ?? DEFAULTS.FONT_SIZE_MAX;
  const maxItems = config?.maxItems ?? DEFAULTS.MAX_ITEMS;
  const colorThresholds = config?.colorThresholds ?? DEFAULT_COLORS;

  if (health < lastHealthRef.current) {
    const dmg = Math.round(lastHealthRef.current - health);
    if (dmg >= 1) {
      const item: DamageNum = {
        id: _nextId++,
        amount: dmg,
        timestamp: Date.now(),
        offsetX: (Math.random() - 0.5) * spread,
      };
      queueMicrotask(() => {
        setItems((prev) => [...prev.slice(-(maxItems - 1)), item]);
      });
    }
  }
  lastHealthRef.current = health;

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((it) => now - it.timestamp < duration * 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [duration]);

  if (items.length === 0) return null;

  function getColor(amount: number): string {
    for (const { min, color } of colorThresholds) {
      if (amount >= min) return color;
    }
    return '#ffffff';
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {items.map((item) => {
        const age = (Date.now() - item.timestamp) / 1000;
        const progress = Math.min(age / duration, 1);
        const opacity = 1 - progress * progress;
        const driftY = age * driftSpeed;
        const fontSize = fontMin + (fontMax - fontMin) * Math.min(item.amount / 80, 1);

        return (
          <div
            key={item.id}
            className="absolute font-mono font-bold"
            style={{
              transform: `translate(${item.offsetX}px, ${-30 - driftY}px)`,
              opacity: Math.max(0, opacity),
              fontSize: `${fontSize}px`,
              color: getColor(item.amount),
              textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)',
            }}
          >
            -{item.amount}
          </div>
        );
      })}
    </div>
  );
}
