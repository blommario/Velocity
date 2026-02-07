import { useCombatStore } from '../../stores/combatStore';
import { PHYSICS } from '../game/physics/constants';
import type { WeaponType } from '../game/physics/types';
import { WEAPON_SLOTS } from '../game/physics/types';

const HEALTH_COLORS = {
  HIGH: '#22c55e',
  MEDIUM: '#eab308',
  LOW: '#ef4444',
} as const;

const WEAPON_LABELS: Record<WeaponType, { short: string; color: string }> = {
  knife:   { short: 'KNIFE',   color: '#a0a0a0' },
  assault: { short: 'AR',      color: '#60a5fa' },
  shotgun: { short: 'SG',      color: '#f59e0b' },
  rocket:  { short: 'RL',      color: '#ef4444' },
  grenade: { short: 'GL',      color: '#22c55e' },
  sniper:  { short: 'SR',      color: '#a78bfa' },
  plasma:  { short: 'PG',      color: '#06b6d4' },
} as const;

function getHealthColor(health: number): string {
  if (health > 60) return HEALTH_COLORS.HIGH;
  if (health > 30) return HEALTH_COLORS.MEDIUM;
  return HEALTH_COLORS.LOW;
}

export function CombatHud() {
  const health = useCombatStore((s) => s.health);
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const ammo = useCombatStore((s) => s.ammo);
  const swapCooldown = useCombatStore((s) => s.swapCooldown);
  const isZoomed = useCombatStore((s) => s.isZoomed);

  const healthFraction = health / PHYSICS.HEALTH_MAX;
  const healthColor = getHealthColor(health);
  const activeAmmo = ammo[activeWeapon];

  return (
    <div className="absolute bottom-8 left-8 space-y-2">
      {/* Health bar */}
      <div>
        <div className="h-1.5 w-48 bg-gray-800/80 rounded overflow-hidden">
          <div
            className="h-full rounded transition-[width] duration-100"
            style={{ width: `${healthFraction * 100}%`, backgroundColor: healthColor }}
          />
        </div>
        <div className="font-mono text-xs mt-0.5" style={{ color: healthColor }}>
          {Math.ceil(health)} HP
        </div>
      </div>

      {/* Active weapon + ammo */}
      <div className="flex items-center gap-3">
        <div
          className="font-mono text-sm font-bold px-2 py-0.5 rounded border"
          style={{
            color: WEAPON_LABELS[activeWeapon].color,
            borderColor: WEAPON_LABELS[activeWeapon].color + '60',
            opacity: swapCooldown > 0 ? 0.4 : 1,
          }}
        >
          {WEAPON_LABELS[activeWeapon].short}
        </div>
        {activeWeapon !== 'knife' && (
          <div className="font-mono text-sm" style={{ color: WEAPON_LABELS[activeWeapon].color }}>
            {activeAmmo.magazine !== undefined
              ? `${activeAmmo.magazine}/${activeAmmo.magSize} [${Math.floor(activeAmmo.current)}]`
              : `${Math.floor(activeAmmo.current)}/${activeAmmo.max}`
            }
          </div>
        )}
        {isZoomed && (
          <div className="font-mono text-[10px] text-purple-400 uppercase">ZOOM</div>
        )}
      </div>

      {/* Weapon slots bar */}
      <div className="flex gap-1">
        {WEAPON_SLOTS.map((w, i) => {
          const label = WEAPON_LABELS[w];
          const isActive = w === activeWeapon;
          const a = ammo[w];
          const hasAmmo = w === 'knife' || a.current > 0;
          return (
            <div
              key={w}
              className="font-mono text-[9px] px-1 py-0.5 rounded"
              style={{
                color: isActive ? label.color : hasAmmo ? '#666' : '#333',
                backgroundColor: isActive ? label.color + '20' : 'transparent',
                borderBottom: isActive ? `1px solid ${label.color}` : '1px solid transparent',
              }}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}
