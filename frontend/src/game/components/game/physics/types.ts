// Re-export engine types for backward compatibility
export type { InputState, MovementState } from '@engine/types/physics';

// Game-specific types
export type WeaponType = 'rocket' | 'grenade' | 'sniper' | 'assault' | 'shotgun' | 'knife' | 'plasma';

/** Named weapon type constants — use instead of raw string literals. */
export const WEAPONS = {
  ROCKET: 'rocket',
  GRENADE: 'grenade',
  SNIPER: 'sniper',
  ASSAULT: 'assault',
  SHOTGUN: 'shotgun',
  KNIFE: 'knife',
  PLASMA: 'plasma',
} as const satisfies Record<string, WeaponType>;

/** Weapon slot order for switching (1-7 keys) */
export const WEAPON_SLOTS: WeaponType[] = ['knife', 'assault', 'shotgun', 'rocket', 'grenade', 'sniper', 'plasma'] as const;
