/**
 * Build a 2D heightmap from MapBlock[] for GPU fog-of-war ray marching.
 *
 * For each grid cell, stores the maximum Y (top surface) of all blocks
 * overlapping that cell. Cells with no blocks get a very low sentinel
 * so rays pass through freely.
 *
 * Runs once per map load — not per frame.
 * Engine-level: no game store imports.
 */

import type { MapBlock } from '../types/map';
import type { FogOfWarConfig } from './FogOfWar';

/** Sentinel value for cells with no geometry. Must be below any plausible block. */
const NO_GEOMETRY = -1e6;

export interface HeightmapConfig {
  gridSize: number;
  cellWorldSize: number;
  originX: number;
  originZ: number;
}

/**
 * Build a heightmap from map blocks.
 *
 * Each cell stores the max Y of all blocks whose XZ AABB overlaps.
 * Row-major: index = z * gridSize + x.
 *
 * @returns Float32Array of gridSize * gridSize.
 */
export function buildHeightmap(
  blocks: ReadonlyArray<MapBlock>,
  config: HeightmapConfig,
): Float32Array {
  const { gridSize, cellWorldSize, originX, originZ } = config;
  const totalCells = gridSize * gridSize;
  const heightmap = new Float32Array(totalCells);
  heightmap.fill(NO_GEOMETRY);

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const [px, py, pz] = block.position;
    const [sx, sy, sz] = block.size;
    const halfX = sx * 0.5;
    const halfZ = sz * 0.5;
    const topY = py + sy * 0.5;

    // Block XZ bounds → cell range (clamped)
    const minCx = Math.max(0, Math.floor((px - halfX - originX) / cellWorldSize));
    const maxCx = Math.min(gridSize - 1, Math.floor((px + halfX - originX) / cellWorldSize));
    const minCz = Math.max(0, Math.floor((pz - halfZ - originZ) / cellWorldSize));
    const maxCz = Math.min(gridSize - 1, Math.floor((pz + halfZ - originZ) / cellWorldSize));

    for (let cz = minCz; cz <= maxCz; cz++) {
      const row = cz * gridSize;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const idx = row + cx;
        if (topY > heightmap[idx]) {
          heightmap[idx] = topY;
        }
      }
    }
  }

  return heightmap;
}

/** Extract heightmap-relevant config from FogOfWarConfig. */
export function fogConfigToHeightmapConfig(config: FogOfWarConfig): HeightmapConfig {
  return {
    gridSize: config.gridSize,
    cellWorldSize: config.cellWorldSize,
    originX: config.originX,
    originZ: config.originZ,
  };
}
