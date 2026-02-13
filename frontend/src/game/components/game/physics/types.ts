/**
 * Game-specific weapon types, slot order, and re-exported engine physics types.
 *
 * Depends on: @engine/types/physics
 * Used by: constants, combatStore, weaponFire, combatTick
 */
// Re-export engine types for backward compatibility
export type { InputState, MovementState } from '@engine/types/physics';

// Game-specific types
export type WeaponType = 'rocket' | 'grenade' | 'sniper' | 'assault' | 'shotgun' | 'knife' | 'plasma' | 'pistol';

/** Named weapon type constants — use instead of raw string literals. */
export const WEAPONS = {
  ROCKET: 'rocket',
  GRENADE: 'grenade',
  SNIPER: 'sniper',
  ASSAULT: 'assault',
  SHOTGUN: 'shotgun',
  KNIFE: 'knife',
  PLASMA: 'plasma',
  PISTOL: 'pistol',
} as const satisfies Record<string, WeaponType>;

/** Weapon slot order for switching (1-8 keys) */
export const WEAPON_SLOTS: WeaponType[] = ['knife', 'pistol', 'assault', 'shotgun', 'rocket', 'grenade', 'sniper', 'plasma'] as const;
