import { useEffect, useRef, useState } from 'react';
import { useCombatStore } from '../../stores/combatStore';

const DMG_NUM = {
  DURATION: 1.2,       // seconds before fade-out
  DRIFT_SPEED: 40,     // pixels/sec upward drift
  SPREAD: 60,          // max horizontal spread (pixels)
  FONT_SIZE_MIN: 14,
  FONT_SIZE_MAX: 28,
  MAX_ITEMS: 6,
} as const;

interface DamageNum {
  id: number;
  amount: number;
  timestamp: number;
  offsetX: number;     // random horizontal offset
}

let _nextId = 0;

export function DamageNumbers() {
  const [items, setItems] = useState<DamageNum[]>([]);
  const lastHealthRef = useRef(100);

  const health = useCombatStore((s) => s.health);

  // Detect damage via health change
  if (health < lastHealthRef.current) {
    const dmg = Math.round(lastHealthRef.current - health);
    if (dmg >= 1) {
      const item: DamageNum = {
        id: _nextId++,
        amount: dmg,
        timestamp: Date.now(),
        offsetX: (Math.random() - 0.5) * DMG_NUM.SPREAD,
      };
      // Defer state update to avoid render-during-render
      queueMicrotask(() => {
        setItems((prev) => [...prev.slice(-(DMG_NUM.MAX_ITEMS - 1)), item]);
      });
    }
  }
  lastHealthRef.current = health;

  // Cleanup expired
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((it) => now - it.timestamp < DMG_NUM.DURATION * 1000));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {items.map((item) => {
        const age = (Date.now() - item.timestamp) / 1000;
        const progress = Math.min(age / DMG_NUM.DURATION, 1);
        const opacity = 1 - progress * progress; // ease-out fade
        const driftY = age * DMG_NUM.DRIFT_SPEED;
        const fontSize = DMG_NUM.FONT_SIZE_MIN +
          (DMG_NUM.FONT_SIZE_MAX - DMG_NUM.FONT_SIZE_MIN) * Math.min(item.amount / 80, 1);

        return (
          <div
            key={item.id}
            className="absolute font-mono font-bold"
            style={{
              transform: `translate(${item.offsetX}px, ${-30 - driftY}px)`,
              opacity: Math.max(0, opacity),
              fontSize: `${fontSize}px`,
              color: item.amount >= 50 ? '#ff4444' : item.amount >= 20 ? '#ffaa22' : '#ffffff',
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
