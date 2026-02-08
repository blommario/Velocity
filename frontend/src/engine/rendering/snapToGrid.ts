import type { Vec3 } from '../types/map';

/**
 * Snap a single value to the nearest grid increment.
 *
 * @param value  - The value to snap
 * @param gridSize - Grid cell size (must be > 0)
 * @returns The snapped value
 */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a 3D position to the nearest grid point.
 * Returns a new Vec3 tuple — does not mutate the input.
 *
 * @param pos      - [x, y, z] position
 * @param gridSize - Grid cell size (must be > 0)
 * @returns Snapped [x, y, z]
 */
export function snapPosition(pos: Vec3, gridSize: number): Vec3 {
  return [
    snapToGrid(pos[0], gridSize),
    snapToGrid(pos[1], gridSize),
    snapToGrid(pos[2], gridSize),
  ];
}

/**
 * Snap an angle (radians) to the nearest rotation step.
 *
 * @param angle - Angle in radians
 * @param step  - Rotation step in radians (e.g. Math.PI / 4 for 45°)
 * @returns Snapped angle in radians
 */
export function snapRotation(angle: number, step: number): number {
  if (step <= 0) return angle;
  return Math.round(angle / step) * step;
}
