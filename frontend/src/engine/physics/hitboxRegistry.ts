/**
 * Generic hitbox registry — maps Rapier collider handles to hitbox zone metadata.
 * Pure module with O(1) lookup, safe for 128Hz physics tick.
 * Depends on: nothing (standalone)
 * Used by: weaponFire.ts (resolve hits), TargetDummy (register/unregister)
 */

/** Hitbox zone identifiers. */
export type HitboxZone = 'head' | 'torso' | 'limb';

/** Metadata for a single hitbox collider. */
export interface HitboxInfo {
  /** Which body zone this collider represents */
  zone: HitboxZone;
  /** Damage multiplier for this zone (e.g., head=2.5, torso=1.0, limb=0.75) */
  multiplier: number;
  /** Entity ID that owns this hitbox (for multi-target scenarios) */
  entityId: string;
}

// Module-level registry — keyed by Rapier ColliderHandle (number)
const _registry = new Map<number, HitboxInfo>();

/** Register a collider handle as a hitbox zone. */
export function registerHitbox(colliderHandle: number, info: HitboxInfo): void {
  _registry.set(colliderHandle, info);
}

/** Unregister a single collider handle. */
export function unregisterHitbox(colliderHandle: number): void {
  _registry.delete(colliderHandle);
}

/** Unregister all hitboxes belonging to a specific entity. */
export function unregisterEntity(entityId: string): void {
  for (const [handle, info] of _registry) {
    if (info.entityId === entityId) _registry.delete(handle);
  }
}

/** Resolve a collider handle to hitbox info. Returns null if not a hitbox. */
export function resolveHitbox(colliderHandle: number): HitboxInfo | null {
  return _registry.get(colliderHandle) ?? null;
}

/** Clear all registered hitboxes (call on map unload / reset). */
export function clearHitboxRegistry(): void {
  _registry.clear();
}
