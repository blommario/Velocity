import { useMemo } from 'react';
import { CombatHud as EngineCombatHud, type WeaponDisplay, type AmmoDisplay } from '../../engine/hud';
import { useCombatStore } from '../../stores/combatStore';
import { PHYSICS } from '../game/physics/constants';
import type { WeaponType } from '../game/physics/types';
import { WEAPON_SLOTS } from '../game/physics/types';

const WEAPON_LABELS: Record<WeaponType, WeaponDisplay> = {
  knife:   { id: 'knife',   short: 'KNIFE', color: '#a0a0a0' },
  assault: { id: 'assault', short: 'AR',    color: '#60a5fa' },
  shotgun: { id: 'shotgun', short: 'SG',    color: '#f59e0b' },
  rocket:  { id: 'rocket',  short: 'RL',    color: '#ef4444' },
  grenade: { id: 'grenade', short: 'GL',    color: '#22c55e' },
  sniper:  { id: 'sniper',  short: 'SR',    color: '#a78bfa' },
  plasma:  { id: 'plasma',  short: 'PG',    color: '#06b6d4' },
} as const;

export function CombatHud() {
  const health = useCombatStore((s) => s.health);
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const ammo = useCombatStore((s) => s.ammo);
  const swapCooldown = useCombatStore((s) => s.swapCooldown);
  const isZoomed = useCombatStore((s) => s.isZoomed);

  const activeDisplay = WEAPON_LABELS[activeWeapon];
  const activeAmmo = ammo[activeWeapon];

  const ammoDisplay: AmmoDisplay | null = activeWeapon === 'knife' ? null : {
    current: activeAmmo.current,
    max: activeAmmo.max,
    magazine: activeAmmo.magazine,
    magSize: activeAmmo.magSize,
  };

  const slots = useMemo(() =>
    WEAPON_SLOTS.map((w) => ({
      weapon: WEAPON_LABELS[w],
      hasAmmo: w === 'knife' || ammo[w].current > 0,
    })),
  [ammo]);

  return (
    <EngineCombatHud
      health={health}
      healthMax={PHYSICS.HEALTH_MAX}
      activeWeapon={activeDisplay}
      ammo={ammoDisplay}
      isZoomed={isZoomed}
      swapCooldown={swapCooldown}
      slots={slots}
    />
  );
}
