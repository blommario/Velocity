/**
 * Spawns visual + audio impact feedback (sparks, decals, sounds).
 *
 * Depends on: ExplosionEffect (particle burst), DecalPool, AudioManager
 * Used by: projectile hit logic, hitscan raycasts
 */
import { useExplosionStore } from './ExplosionEffect';
import { spawnDecal } from './DecalPool';
import { audioManager, SOUNDS } from '../audio/AudioManager';

const SPARK_SCALES: Record<string, number> = { light: 0.8, medium: 1.5, heavy: 3.0 };
const DECAL_SIZES: Record<string, number> = { light: 0.15, medium: 0.4, heavy: 1.0 };

export type ImpactIntensity = 'light' | 'medium' | 'heavy';

/** Named impact intensity constants — use instead of raw string literals. */
export const IMPACT = {
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
} as const satisfies Record<string, ImpactIntensity>;

/**
 * Spawn impact effects (spark burst + decal + audio) at a hit point.
 * Uses the existing explosion particle system with small scale + orange color.
 */
export function spawnImpactEffects(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  intensity: ImpactIntensity = 'medium',
  color = '#ffaa22',
): void {
  // Spark burst via explosion system (small scale = tiny fast particles)
  useExplosionStore.getState().spawnExplosion(
    [x, y, z],
    color,
    SPARK_SCALES[intensity],
  );

  // Impact decal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- literal type from `as const` default param
  (spawnDecal as any)(x, y, z, nx, ny, nz, DECAL_SIZES[intensity], 0.1, 0.1, 0.1, 6.0);

  // Impact audio
  audioManager.play(SOUNDS.WALL_IMPACT, 0.06);
}
