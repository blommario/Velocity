/**
 * Mutable projectile pool — zero GC, no Zustand.
 *
 * All projectile data lives here as pre-allocated objects.
 * usePhysicsTick mutates in-place. ProjectileRenderer reads directly.
 * Only UI-relevant events (ammo changes) go through Zustand.
 */
import type { WeaponType } from './types';

export interface PoolProjectile {
  active: boolean;
  id: number;
  type: WeaponType;
  posX: number;
  posY: number;
  posZ: number;
  velX: number;
  velY: number;
  velZ: number;
  spawnTime: number;
  bounces: number;
}

/** Pool capacity — max simultaneous projectiles */
const MAX_PROJECTILES = 16;

/** Pre-allocated pool — never resized, never garbage collected */
const pool: PoolProjectile[] = [];
for (let i = 0; i < MAX_PROJECTILES; i++) {
  pool.push({
    active: false,
    id: 0,
    type: 'rocket',
    posX: 0, posY: 0, posZ: 0,
    velX: 0, velY: 0, velZ: 0,
    spawnTime: 0,
    bounces: 0,
  });
}

let nextId = 1;

/** Spawn a projectile into the pool. Returns the id, or -1 if pool is full. */
export function spawnProjectile(
  type: WeaponType,
  posX: number, posY: number, posZ: number,
  velX: number, velY: number, velZ: number,
): number {
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    if (!pool[i].active) {
      const id = nextId++;
      const p = pool[i];
      p.active = true;
      p.id = id;
      p.type = type;
      p.posX = posX; p.posY = posY; p.posZ = posZ;
      p.velX = velX; p.velY = velY; p.velZ = velZ;
      p.spawnTime = performance.now();
      p.bounces = 0;
      return id;
    }
  }
  return -1; // Pool full
}

/** Deactivate a projectile by index (NOT id). */
export function deactivateAt(index: number): void {
  pool[index].active = false;
}

/** Deactivate a projectile by id. */
export function deactivateById(id: number): void {
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    if (pool[i].active && pool[i].id === id) {
      pool[i].active = false;
      return;
    }
  }
}

/** Update positions of all active projectiles. Applies gravity to grenades. */
export function updatePositions(dt: number, gravity: number): void {
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    const p = pool[i];
    if (!p.active) continue;
    p.posX += p.velX * dt;
    p.posY += p.velY * dt;
    p.posZ += p.velZ * dt;
    if (p.type === 'grenade') {
      p.velY -= gravity * dt;
    }
  }
}

/** Get the pool array for iteration. Length is always MAX_PROJECTILES. Check .active. */
export function getPool(): readonly PoolProjectile[] {
  return pool;
}

/** Get pool capacity. */
export function getPoolSize(): number {
  return MAX_PROJECTILES;
}

/** Count active projectiles. */
export function activeCount(): number {
  let count = 0;
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    if (pool[i].active) count++;
  }
  return count;
}

/** Reset all projectiles (e.g. on map load). */
export function resetPool(): void {
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    pool[i].active = false;
  }
  nextId = 1;
}
