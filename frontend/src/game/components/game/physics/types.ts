// Re-export engine types for backward compatibility
export type { InputState, MovementState } from '@engine/types/physics';

// Game-specific types
export type WeaponType = 'rocket' | 'grenade' | 'sniper' | 'assault' | 'shotgun' | 'knife' | 'plasma';

/** Weapon slot order for switching (1-7 keys) */
export const WEAPON_SLOTS: WeaponType[] = ['knife', 'assault', 'shotgun', 'rocket', 'grenade', 'sniper', 'plasma'] as const;
