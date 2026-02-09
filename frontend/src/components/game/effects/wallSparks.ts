import { useExplosionStore } from '../../../engine/effects/ExplosionEffect';
import { spawnDecal } from '../../../engine/effects/DecalPool';
import { audioManager, SOUNDS } from '../../../engine/audio/AudioManager';

const SPARK_SCALES: Record<string, number> = { light: 0.8, medium: 1.5, heavy: 3.0 };
const DECAL_SIZES: Record<string, number> = { light: 0.15, medium: 0.4, heavy: 1.0 };

/**
 * Spawn wall spark effects at a projectile impact point.
 * Uses the existing explosion particle system with small scale + orange color.
 * Also spawns a small decal mark and plays impact audio.
 */
export function spawnWallSparks(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  intensity: 'light' | 'medium' | 'heavy' = 'medium',
): void {
  // Spark burst via explosion system (small scale = tiny fast particles)
  useExplosionStore.getState().spawnExplosion(
    [x, y, z],
    '#ffaa22',
    SPARK_SCALES[intensity],
  );

  // Impact decal
  spawnDecal(x, y, z, nx, ny, nz, DECAL_SIZES[intensity], 0.1, 0.1, 0.1, 6.0);

  // Impact audio
  audioManager.play(SOUNDS.WALL_IMPACT, 0.06);
}
