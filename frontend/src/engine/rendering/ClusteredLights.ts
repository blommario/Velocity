/**
 * ClusteredLights.ts — Pure logic for selecting the N nearest lights
 * to a view position. No React, no Three.js scene objects.
 *
 * Used by useClusteredLighting hook to drive a PointLight pool.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LightData {
  position: [number, number, number];
  color: string;
  intensity: number;
  /** Cutoff distance. 0 = infinite (not recommended for performance). */
  distance: number;
  /** Attenuation decay exponent. Default 2 (physically correct). */
  decay: number;
}

export interface ClusteredLightsConfig {
  /** Max number of active PointLights in pool. Default 8. */
  maxActiveLights: number;
  /** How often to re-sort lights (seconds). Default 0.25. */
  updateInterval: number;
  /** Max light influence radius for pre-filter. Default 50. */
  attenuationRadius: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const CLUSTERED_DEFAULTS: Readonly<ClusteredLightsConfig> = {
  maxActiveLights: 8,
  updateInterval: 0.25,
  attenuationRadius: 50,
} as const;

// ---------------------------------------------------------------------------
// Pre-allocated sort helper (zero GC)
// ---------------------------------------------------------------------------

interface ScoredLight {
  index: number;
  distSq: number;
}

const _scored: ScoredLight[] = [];
const _result: number[] = [];

/**
 * Select the N nearest lights to a viewpoint (XZ distance).
 * Returns indices into the input array, sorted nearest-first.
 *
 * Brute-force O(N log N) — sufficient for <200 lights.
 * For 500+ lights, use SpatialGrid pre-filter (Steg 2).
 */
export function selectNearestLights(
  allLights: readonly LightData[],
  viewX: number,
  viewY: number,
  viewZ: number,
  maxCount: number,
): number[] {
  // Grow scratch array if needed
  while (_scored.length < allLights.length) {
    _scored.push({ index: 0, distSq: 0 });
  }

  // Score each light by full 3D distance²
  for (let i = 0; i < allLights.length; i++) {
    const pos = allLights[i].position;
    const dx = pos[0] - viewX;
    const dy = pos[1] - viewY;
    const dz = pos[2] - viewZ;
    _scored[i].index = i;
    _scored[i].distSq = dx * dx + dy * dy + dz * dz;
  }

  // Partial sort: only need top maxCount
  const count = allLights.length;
  const n = Math.min(maxCount, count);

  // Selection sort top-N in-place (no Set/Array allocation).
  // Swap selected elements to front of _scored, then read indices.
  for (let pick = 0; pick < n; pick++) {
    let bestIdx = pick;
    let bestDist = _scored[pick].distSq;
    for (let i = pick + 1; i < count; i++) {
      if (_scored[i].distSq < bestDist) {
        bestDist = _scored[i].distSq;
        bestIdx = i;
      }
    }
    if (bestIdx !== pick) {
      const tmp = _scored[pick];
      _scored[pick] = _scored[bestIdx];
      _scored[bestIdx] = tmp;
    }
  }

  // Reuse a pre-allocated result array (capped at typical maxActiveLights)
  _result.length = n;
  for (let i = 0; i < n; i++) {
    _result[i] = _scored[i].index;
  }
  return _result;
}
