/**
 * Level-of-Detail manager.
 *
 * Distance-based LOD thresholds and helper functions for deciding
 * geometry detail level. Works with SpatialGrid cell distances.
 *
 * Three LOD bands:
 *   FULL    — close to camera, full geometry (box 6 faces, cylinder 16 segments)
 *   SIMPLE  — medium distance, simplified geometry (box 6 faces, cylinder 6 segments)
 *   HIDDEN  — far away, not rendered at all (culled by spatial grid)
 *
 * No external dependencies — pure functions + config.
 */

export const LOD_THRESHOLDS = {
  /** Max distance for full-detail geometry */
  FULL_DETAIL: 100,
  /** Max distance for simplified geometry */
  SIMPLIFIED: 250,
  /** Beyond this distance, objects are hidden */
  HIDDEN: 500,
  /** Hysteresis buffer (units) — prevents flickering at LOD boundaries */
  HYSTERESIS: 10,
} as const;

export const LOD_GEOMETRY = {
  /** Cylinder segments for full detail */
  CYLINDER_SEGMENTS_FULL: 16,
  /** Cylinder segments for simplified */
  CYLINDER_SEGMENTS_SIMPLE: 6,
} as const;

export type LodLevel = 'full' | 'simple' | 'hidden';

/**
 * Determine LOD level based on squared distance from camera.
 * Uses squared distance to avoid sqrt per object.
 */
export function getLodLevel(distanceSq: number): LodLevel {
  if (distanceSq <= LOD_THRESHOLDS.FULL_DETAIL ** 2) return 'full';
  if (distanceSq <= LOD_THRESHOLDS.SIMPLIFIED ** 2) return 'simple';
  return 'hidden';
}

/**
 * Compute squared XZ distance between two points (ignores Y).
 * Use for LOD calculations — avoids sqrt.
 */
export function distanceSqXZ(
  ax: number, az: number,
  bx: number, bz: number,
): number {
  return (ax - bx) ** 2 + (az - bz) ** 2;
}

/**
 * Split a block array into near (full detail) and far (simplified) buckets
 * based on camera position. Blocks beyond SIMPLIFIED threshold are excluded.
 *
 * Uses hysteresis to prevent flickering at LOD boundaries: items that were
 * previously in the "near" bucket get a larger threshold before being demoted.
 *
 * @param prevNearCount — number of items that were in the near bucket last frame.
 *   Used as a heuristic: if the first N items in the array matched near before,
 *   they get the hysteresis buffer. Pass 0 on first call.
 * @returns [nearBlocks, farBlocks]
 */
export function splitByLod<T extends { position: [number, number, number] }>(
  items: T[],
  cameraX: number,
  cameraZ: number,
): [near: T[], far: T[]] {
  const near: T[] = [];
  const far: T[] = [];
  const h = LOD_THRESHOLDS.HYSTERESIS;
  const fullSq = (LOD_THRESHOLDS.FULL_DETAIL + h) ** 2;
  const simpleSq = (LOD_THRESHOLDS.SIMPLIFIED + h) ** 2;

  for (const item of items) {
    const dSq = distanceSqXZ(item.position[0], item.position[2], cameraX, cameraZ);
    if (dSq <= fullSq) {
      near.push(item);
    } else if (dSq <= simpleSq) {
      far.push(item);
    }
    // beyond SIMPLIFIED + HYSTERESIS → hidden, skip
  }

  return [near, far];
}
