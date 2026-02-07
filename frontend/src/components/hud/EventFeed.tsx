import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useCombatStore } from '../../stores/combatStore';

const FEED = {
  MAX_ITEMS: 5,
  ITEM_DURATION: 3000,
} as const;

interface FeedItem {
  id: number;
  text: string;
  color: string;
  icon: string;
  timestamp: number;
}

export function EventFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const nextIdRef = useRef(0);
  const lastCheckpointRef = useRef(-1);
  const lastHealthRef = useRef(100);
  const lastRunStateRef = useRef('ready');

  const currentCheckpoint = useGameStore((s) => s.currentCheckpoint);
  const runState = useGameStore((s) => s.runState);
  const health = useCombatStore((s) => s.health);

  // Detect checkpoint hits
  useEffect(() => {
    if (currentCheckpoint > lastCheckpointRef.current && lastCheckpointRef.current >= 0) {
      addItem(`Checkpoint ${currentCheckpoint}`, '#ffd700', 'flag');
    }
    lastCheckpointRef.current = currentCheckpoint;
  }, [currentCheckpoint]);

  // Detect run state changes
  useEffect(() => {
    if (runState === 'running' && lastRunStateRef.current !== 'running') {
      addItem('Run started!', '#22c55e', 'play');
    }
    if (runState === 'finished' && lastRunStateRef.current !== 'finished') {
      addItem('Run complete!', '#60a5fa', 'trophy');
    }
    lastRunStateRef.current = runState;
  }, [runState]);

  // Detect self-damage
  useEffect(() => {
    if (health < lastHealthRef.current) {
      const dmg = Math.round(lastHealthRef.current - health);
      if (dmg > 10) {
        addItem(`-${dmg} HP`, '#ef4444', 'heart');
      }
    }
    lastHealthRef.current = health;
  }, [health]);

  // Cleanup expired items
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((item) => now - item.timestamp < FEED.ITEM_DURATION));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  function addItem(text: string, color: string, icon: string) {
    const item: FeedItem = {
      id: nextIdRef.current++,
      text,
      color,
      icon,
      timestamp: Date.now(),
    };
    setItems((prev) => [...prev.slice(-(FEED.MAX_ITEMS - 1)), item]);
  }

  if (items.length === 0) return null;

  return (
    <div className="absolute top-16 right-4 space-y-1 pointer-events-none">
      {items.map((item) => {
        const age = Date.now() - item.timestamp;
        const fadeProgress = Math.max(0, (age - FEED.ITEM_DURATION * 0.7) / (FEED.ITEM_DURATION * 0.3));
        const opacity = 1 - fadeProgress;

        return (
          <div
            key={item.id}
            className="font-mono text-xs px-2 py-1 rounded bg-black/40 backdrop-blur-sm flex items-center gap-2 transition-opacity"
            style={{ color: item.color, opacity: Math.max(0, opacity) }}
          >
            <FeedIcon type={item.icon} />
            <span>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function FeedIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    flag: '\u25B6',    // triangle
    play: '\u25BA',    // play symbol
    trophy: '\u2605',  // star
    heart: '\u2665',   // heart
  };
  return <span className="text-[10px]">{icons[type] ?? '\u2022'}</span>;
}
