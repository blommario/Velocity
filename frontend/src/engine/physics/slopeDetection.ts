/**
 * Ground normal detection from KCC computed collisions.
 * Zero-GC: uses module-level pre-allocated tuple.
 */

const RAD2DEG = 180 / Math.PI;

/** Pre-allocated output — callers must consume immediately. */
const _groundNormal: [number, number, number] = [0, 1, 0];

interface KccCollision {
  normal1?: { x: number; y: number; z: number };
}

interface KccController {
  numComputedCollisions(): number;
  computedCollision(i: number): KccCollision | null;
}

/**
 * Scan KCC computed collisions and return the most ground-like normal.
 *
 * Picks the collision with the highest normal.y above threshold
 * (most floor-like). Returns the module-level tuple reference or null.
 */
export function getGroundNormal(
  controller: KccController,
  threshold = 0.7,
): [number, number, number] | null {
  const numCollisions = controller.numComputedCollisions();
  let bestY = -1;
  let found = false;

  for (let i = 0; i < numCollisions; i++) {
    const collision = controller.computedCollision(i);
    if (!collision) continue;
    const n = collision.normal1;
    if (!n) continue;

    if (n.y > threshold && n.y > bestY) {
      bestY = n.y;
      _groundNormal[0] = n.x;
      _groundNormal[1] = n.y;
      _groundNormal[2] = n.z;
      found = true;
    }
  }

  return found ? _groundNormal : null;
}

/** Compute slope angle in degrees from a ground normal Y component. */
export function getSlopeAngleDeg(normalY: number): number {
  return Math.acos(Math.min(normalY, 1.0)) * RAD2DEG;
}
