/**
 * Timed event notification feed with imperative push API.
 *
 * Depends on: —
 * Used by: game HUD composition, game logic (pushFeedEvent)
 */
import { useEffect, useState } from 'react';

export interface FeedItem {
  id: number;
  text: string;
  color: string;
  icon: string;
  timestamp: number;
}

export interface EventFeedConfig {
  maxItems?: number;
  itemDuration?: number;
  className?: string;
}

// Imperative API — module-level queue
let _nextId = 0;
const _pendingEvents: FeedItem[] = [];

/** Push an event from outside React (game logic, physics tick, etc.) */
export function pushFeedEvent(text: string, color: string, icon: string): void {
  _pendingEvents.push({ id: _nextId++, text, color, icon, timestamp: Date.now() });
}

const DEFAULT_ICONS: Record<string, string> = {
  flag: '\u25B6',
  play: '\u25BA',
  trophy: '\u2605',
  heart: '\u2665',
};

export interface EventFeedProps {
  config?: EventFeedConfig;
  /** Icon map override (key → unicode char) */
  icons?: Record<string, string>;
}

export function EventFeed({ config, icons }: EventFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const maxItems = config?.maxItems ?? 5;
  const itemDuration = config?.itemDuration ?? 3000;
  const iconMap = icons ?? DEFAULT_ICONS;

  // Poll for pending events
  useEffect(() => {
    const interval = setInterval(() => {
      if (_pendingEvents.length > 0) {
        setItems((prev) => [...prev, ..._pendingEvents.splice(0)].slice(-maxItems));
      }
      const now = Date.now();
      setItems((prev) => prev.filter((item) => now - item.timestamp < itemDuration));
    }, 100);
    return () => clearInterval(interval);
  }, [maxItems, itemDuration]);

  if (items.length === 0) return null;

  return (
    <div className={config?.className ?? 'absolute top-16 right-4 space-y-1 pointer-events-none'}>
      {items.map((item) => {
        const age = Date.now() - item.timestamp;
        const fadeProgress = Math.max(0, (age - itemDuration * 0.7) / (itemDuration * 0.3));
        const opacity = 1 - fadeProgress;

        return (
          <div
            key={item.id}
            className="font-mono text-xs px-2 py-1 rounded bg-black/40 backdrop-blur-sm flex items-center gap-2 transition-opacity"
            style={{ color: item.color, opacity: Math.max(0, opacity) }}
          >
            <span className="text-[10px]">{iconMap[item.icon] ?? '\u2022'}</span>
            <span>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}
