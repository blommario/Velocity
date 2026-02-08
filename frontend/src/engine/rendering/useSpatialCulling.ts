/**
 * React hook that returns active cell keys based on camera position.
 *
 * Updates at ~4Hz (every ~250ms) to avoid per-frame overhead.
 * Consumers compare cell keys to decide which objects to render.
 *
 * Engine hook — may import settingsStore but no game stores.
 */
import { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import type { CellKey } from './SpatialGrid';
import { SpatialGrid } from './SpatialGrid';

const CULLING_UPDATE_INTERVAL = 0.25; // seconds between culling updates

export interface SpatialCullingConfig {
  /** View radius in world units. Cells within this range are active. */
  viewRadius: number;
  /** Grid cell size. Should match the SpatialGrid used for insertion. */
  cellSize: number;
}

const DEFAULT_CONFIG: SpatialCullingConfig = {
  viewRadius: 200,
  cellSize: 32,
};

/**
 * Returns a Set of active CellKeys near the camera, updated at ~4Hz.
 * Also returns a stable SpatialGrid instance for building the grid.
 */
export function useSpatialCulling<T>(config?: Partial<SpatialCullingConfig>) {
  const { viewRadius, cellSize } = { ...DEFAULT_CONFIG, ...config };

  const gridRef = useRef<SpatialGrid<T> | null>(null);
  if (!gridRef.current) {
    gridRef.current = new SpatialGrid<T>({ cellSize });
  }

  const [activeCells, setActiveCells] = useState<ReadonlySet<CellKey>>(
    () => new Set<CellKey>(),
  );
  const timerRef = useRef(0);
  const prevKeysRef = useRef('');

  const grid = gridRef.current;

  useFrame(({ camera }, delta) => {
    // Infinite viewRadius means "show everything" — skip spatial query entirely
    if (!isFinite(viewRadius)) return;

    timerRef.current += delta;
    if (timerRef.current < CULLING_UPDATE_INTERVAL) return;
    timerRef.current = 0;

    const camX = camera.position.x;
    const camZ = camera.position.z;
    const keys = grid.getCellsInRadius(camX, camZ, viewRadius);

    // Only update state if cell set actually changed
    const keysStr = keys.join('|');
    if (keysStr === prevKeysRef.current) return;
    prevKeysRef.current = keysStr;

    setActiveCells(new Set(keys));
  });

  const resetGrid = useCallback(() => {
    gridRef.current?.clear();
  }, []);

  return { grid, activeCells, resetGrid } as const;
}
