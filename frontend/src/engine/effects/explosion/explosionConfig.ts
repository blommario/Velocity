/**
 * Configuration constants and CPU-side types for the explosion particle system.
 *
 * Depends on: none
 * Used by: explosionStore, explosionParticles, ExplosionEffect
 */

export const EXPLOSION = {
  PARTICLE_COUNT: 384,
  SPRITE_SIZE: 0.9,
  SPEED: 24.0,
  LIFE: 1.5,
  GRAVITY: 4.0,
  EMISSIVE_MULT: 4.0,
  /** Max simultaneous explosions — slots are pre-allocated at mount */
  POOL_SIZE: 8,
  /** Hidden Y for inactive sprites */
  HIDDEN_Y: -9999,
  /** Max queued requests to avoid memory spikes */
  MAX_REQUESTS: 16,
} as const;

/** Total sprite instances across all slots */
export const TOTAL_PARTICLES = EXPLOSION.POOL_SIZE * EXPLOSION.PARTICLE_COUNT;

export interface ExplosionRequest {
  id: number;
  position: [number, number, number];
  color: string;
  scale: number;
}

/** CPU-side particle state — mutable in-place, zero GC. */
export interface ParticleArrays {
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
}

export interface SlotState {
  active: boolean;
  /** Set true when slot just died — triggers one-time GPU zero-out */
  needsCleanup: boolean;
  timeAlive: number;
  scale: number;
  colorR: number;
  colorG: number;
  colorB: number;
}
