/**
 * 2D fog-of-war visibility grid.
 *
 * CPU-side Uint8Array updated at ~4Hz. Three visibility states:
 *   HIDDEN (0) — never seen
 *   PREVIOUSLY_SEEN (128) — visited but out of range
 *   VISIBLE (255) — currently in view radius
 *
 * Distance-based reveal around a viewer position on the XZ plane.
 * No external dependencies — pure data structure.
 */

export interface FogOfWarConfig {
  /** Cells per axis (gridSize × gridSize total). Default 128. */
  gridSize: number;
  /** World units per cell. Default 4 (128×4 = 512 world units). */
  cellWorldSize: number;
  /** Full-visibility radius in world units. Default 40. */
  revealRadius: number;
  /** Soft-edge fade width in world units. Default 8. */
  fadeRadius: number;
  /** World X of grid origin (bottom-left corner). Default -256. */
  originX: number;
  /** World Z of grid origin (bottom-left corner). Default -256. */
  originZ: number;
  /** Enable GPU ray march against heightmap for line-of-sight occlusion. Default false. */
  heightmapEnabled?: boolean;
}

export const FOG_DEFAULTS: Readonly<FogOfWarConfig> = {
  gridSize: 128,
  cellWorldSize: 4,
  revealRadius: 40,
  fadeRadius: 8,
  originX: -256,
  originZ: -256,
} as const;

/** Visibility state constants stored in the grid. */
export const VisibilityState = {
  HIDDEN: 0,
  PREVIOUSLY_SEEN: 128,
  VISIBLE: 255,
} as const;

export type VisibilityValue = (typeof VisibilityState)[keyof typeof VisibilityState];

export class FogOfWarGrid {
  readonly gridSize: number;
  readonly cellWorldSize: number;
  readonly revealRadius: number;
  readonly fadeRadius: number;
  readonly originX: number;
  readonly originZ: number;

  /** Raw visibility data. Row-major: index = z * gridSize + x. */
  readonly grid: Uint8Array;

  private readonly totalRadius: number;
  private readonly revealRadiusSq: number;
  private readonly totalRadiusSq: number;

  // Track previous reveal bounds for efficient VISIBLE→PREVIOUSLY_SEEN clearing
  private prevMinCx = 0;
  private prevMaxCx = 0;
  private prevMinCz = 0;
  private prevMaxCz = 0;
  private hasPrevBounds = false;

  constructor(config?: Partial<FogOfWarConfig>) {
    const c = { ...FOG_DEFAULTS, ...config };
    this.gridSize = c.gridSize;
    this.cellWorldSize = c.cellWorldSize;
    this.revealRadius = c.revealRadius;
    this.fadeRadius = c.fadeRadius;
    this.originX = c.originX;
    this.originZ = c.originZ;

    this.grid = new Uint8Array(c.gridSize * c.gridSize);

    this.totalRadius = c.revealRadius + c.fadeRadius;
    this.revealRadiusSq = c.revealRadius * c.revealRadius;
    this.totalRadiusSq = this.totalRadius * this.totalRadius;
  }

  /** Update visibility around a viewer world position. */
  update(viewX: number, viewZ: number): void {
    const { gridSize, cellWorldSize, originX, originZ, grid } = this;
    const { revealRadiusSq, totalRadiusSq, totalRadius } = this;
    const revealR = this.revealRadius;

    // Cell range to check (clamped to grid bounds)
    const cellRadius = Math.ceil(totalRadius / cellWorldSize);
    const viewCx = (viewX - originX) / cellWorldSize;
    const viewCz = (viewZ - originZ) / cellWorldSize;
    const minCx = Math.max(0, Math.floor(viewCx - cellRadius));
    const maxCx = Math.min(gridSize - 1, Math.ceil(viewCx + cellRadius));
    const minCz = Math.max(0, Math.floor(viewCz - cellRadius));
    const maxCz = Math.min(gridSize - 1, Math.ceil(viewCz + cellRadius));

    // Fade previously VISIBLE cells to PREVIOUSLY_SEEN.
    // Only scan the bounding box from the last update (not the entire grid).
    if (this.hasPrevBounds) {
      for (let cz = this.prevMinCz; cz <= this.prevMaxCz; cz++) {
        const rowOffset = cz * gridSize;
        for (let cx = this.prevMinCx; cx <= this.prevMaxCx; cx++) {
          if (grid[rowOffset + cx] === VisibilityState.VISIBLE) {
            grid[rowOffset + cx] = VisibilityState.PREVIOUSLY_SEEN;
          }
        }
      }
    }

    this.prevMinCx = minCx;
    this.prevMaxCx = maxCx;
    this.prevMinCz = minCz;
    this.prevMaxCz = maxCz;
    this.hasPrevBounds = true;

    // Reveal cells within radius
    for (let cz = minCz; cz <= maxCz; cz++) {
      const worldZ = originZ + (cz + 0.5) * cellWorldSize;
      const dz = worldZ - viewZ;
      const dzSq = dz * dz;
      const rowOffset = cz * gridSize;

      for (let cx = minCx; cx <= maxCx; cx++) {
        const worldX = originX + (cx + 0.5) * cellWorldSize;
        const dx = worldX - viewX;
        const distSq = dx * dx + dzSq;

        if (distSq <= revealRadiusSq) {
          // Full visibility
          grid[rowOffset + cx] = VisibilityState.VISIBLE;
        } else if (distSq <= totalRadiusSq) {
          // Fade zone — lerp between VISIBLE and PREVIOUSLY_SEEN
          const dist = Math.sqrt(distSq);
          const t = (dist - revealR) / this.fadeRadius; // 0..1
          const value = Math.round(255 - t * (255 - 128));
          // Only upgrade, never downgrade
          if (value > grid[rowOffset + cx]) {
            grid[rowOffset + cx] = value;
          }
        }
        // Outside totalRadius: keep current state (HIDDEN or PREVIOUSLY_SEEN)
      }
    }
  }

  /** Get visibility at a world XZ position. */
  getCell(worldX: number, worldZ: number): number {
    const cx = Math.floor((worldX - this.originX) / this.cellWorldSize);
    const cz = Math.floor((worldZ - this.originZ) / this.cellWorldSize);
    if (cx < 0 || cx >= this.gridSize || cz < 0 || cz >= this.gridSize) {
      return VisibilityState.HIDDEN;
    }
    return this.grid[cz * this.gridSize + cx];
  }

  /** Reset entire grid to HIDDEN. */
  reset(): void {
    this.grid.fill(VisibilityState.HIDDEN);
    this.hasPrevBounds = false;
  }
}
