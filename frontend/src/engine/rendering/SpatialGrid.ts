/**
 * 2D spatial partitioning grid on the XZ plane.
 *
 * Divides the world into uniform cells for efficient spatial queries.
 * Foundation for LOD, fog-of-war, and large-world culling.
 *
 * All operations are O(1) per item or O(cells) per query.
 * No external dependencies — pure data structure.
 */

export interface SpatialGridConfig {
  /** Size of each grid cell in world units. Default 32. */
  cellSize: number;
}

/** Opaque cell key for map lookups. Format: "cx,cz" */
export type CellKey = string;

export interface CellCoord {
  cx: number;
  cz: number;
}

const DEFAULT_CELL_SIZE = 32;

export class SpatialGrid<T> {
  readonly cellSize: number;
  private readonly cells = new Map<CellKey, T[]>();

  constructor(config?: Partial<SpatialGridConfig>) {
    this.cellSize = config?.cellSize ?? DEFAULT_CELL_SIZE;
  }

  /** Convert a world XZ position to cell coordinates. */
  worldToCell(x: number, z: number): CellCoord {
    return {
      cx: Math.floor(x / this.cellSize),
      cz: Math.floor(z / this.cellSize),
    };
  }

  /** Get the canonical key for a cell coordinate. */
  cellKey(cx: number, cz: number): CellKey {
    return `${cx},${cz}`;
  }

  /** Insert an item at a world XZ position. */
  insert(x: number, z: number, item: T): void {
    const { cx, cz } = this.worldToCell(x, z);
    const key = this.cellKey(cx, cz);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(item);
  }

  /** Get all items in a specific cell by coordinates. Returns empty array if empty. */
  getCell(cx: number, cz: number): readonly T[] {
    return this.cells.get(this.cellKey(cx, cz)) ?? _empty;
  }

  /** Get all items in a cell by its key. O(1) lookup — use when iterating activeCells. */
  getCellByKey(key: CellKey): readonly T[] {
    return this.cells.get(key) ?? _empty;
  }

  /**
   * Query all cell keys within a radius from a world XZ position.
   * Returns the set of CellKeys whose cell center is within range.
   */
  getCellsInRadius(x: number, z: number, radius: number): CellKey[] {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const { cx: centerCx, cz: centerCz } = this.worldToCell(x, z);
    const result: CellKey[] = [];

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        // Check if cell center is actually within radius
        const cellCenterX = (cx + 0.5) * this.cellSize;
        const cellCenterZ = (cz + 0.5) * this.cellSize;
        const distSq = (cellCenterX - x) ** 2 + (cellCenterZ - z) ** 2;
        if (distSq <= (radius + this.cellSize * 0.707) ** 2) {
          result.push(this.cellKey(cx, cz));
        }
      }
    }

    return result;
  }

  /**
   * Query all items within a sphere (XZ distance check) from a world position.
   * The Y component is ignored — this is a 2D grid.
   */
  querySphere(x: number, z: number, radius: number): T[] {
    const keys = this.getCellsInRadius(x, z, radius);
    const result: T[] = [];
    for (const key of keys) {
      const bucket = this.cells.get(key);
      if (bucket) {
        for (const item of bucket) {
          result.push(item);
        }
      }
    }
    return result;
  }

  /** Total number of occupied cells. */
  get size(): number {
    return this.cells.size;
  }

  /** Clear all data. */
  clear(): void {
    this.cells.clear();
  }
}

const _empty: readonly never[] = [];
