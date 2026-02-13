/**
 * Kill feed display — shows recent kill notifications (killer, weapon icon, victim) with auto-expiry and fade-out. Exposes an imperative pushKillFeedItem API for the physics/network layer.
 * Depends on: WeaponType (physics types)
 * Used by: HudOverlay
 */
import { useEffect, useState } from 'react';
import type { WeaponType } from '../../components/game/physics/types';

const KILL_FEED = {
  MAX_ITEMS: 5,
  ITEM_DURATION: 4000,
} as const;

interface KillFeedItem {
  id: number;
  killer: string;
  victim: string;
  weapon: WeaponType;
  timestamp: number;
}

// Imperative API for physics/network layer
let _nextId = 0;
const _pendingKills: KillFeedItem[] = [];

export function pushKillFeedItem(killer: string, victim: string, weapon: WeaponType): void {
  _pendingKills.push({
    id: _nextId++,
    killer,
    victim,
    weapon,
    timestamp: Date.now(),
  });
}

const WEAPON_ICONS: Record<WeaponType, string> = {
  rocket: '\u{1F4A5}',   // explosion
  grenade: '\u{1F4A3}',  // bomb
  sniper: '\u{1F3AF}',   // bullseye
  assault: '\u{1F52B}',  // gun (fallback)
  shotgun: '\u25A0',      // filled square
  knife: '\u{1F5E1}',    // dagger (or fallback)
  plasma: '\u26A1',      // lightning
  pistol: '\u{1F52B}',  // gun
};

export function KillFeed() {
  const [items, setItems] = useState<KillFeedItem[]>([]);

  // Poll for pending kills
  useEffect(() => {
    const interval = setInterval(() => {
      if (_pendingKills.length > 0) {
        setItems((prev) => [...prev, ..._pendingKills.splice(0)].slice(-KILL_FEED.MAX_ITEMS));
      }
      // Cleanup expired
      const now = Date.now();
      setItems((prev) => prev.filter((it) => now - it.timestamp < KILL_FEED.ITEM_DURATION));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 space-y-1 pointer-events-none">
      {items.map((item) => {
        const age = Date.now() - item.timestamp;
        const fadeProgress = Math.max(0, (age - KILL_FEED.ITEM_DURATION * 0.7) / (KILL_FEED.ITEM_DURATION * 0.3));
        const opacity = 1 - fadeProgress;

        return (
          <div
            key={item.id}
            className="font-mono text-xs px-2 py-1 rounded bg-black/50 backdrop-blur-sm flex items-center gap-2"
            style={{ opacity: Math.max(0, opacity) }}
          >
            <span className="text-red-400 font-bold">{item.killer}</span>
            <span className="text-white/60">{WEAPON_ICONS[item.weapon] ?? '\u2022'}</span>
            <span className="text-white/80">{item.victim}</span>
          </div>
        );
      })}
    </div>
  );
}
