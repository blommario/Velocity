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

    // Fade any currently VISIBLE cells to PREVIOUSLY_SEEN first.
    // Only iterate the full grid if we need to — track if any were visible.
    // Optimization: since update runs at ~4Hz and grid is 16KB, full scan is fine.
    for (let i = 0, len = grid.length; i < len; i++) {
      if (grid[i] === VisibilityState.VISIBLE) {
        grid[i] = VisibilityState.PREVIOUSLY_SEEN;
      }
    }

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
  }
}
