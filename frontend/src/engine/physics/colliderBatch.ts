/**
 * Batches static MapBlocks into compound Rapier rigid bodies by shape.
 *
 * Depends on: types/map
 * Used by: map loader, rendering layer
 */
import type { MapBlock, Vec3 } from '../types/map';

/**
 * Collider shape types that can be batched into compound rigid bodies.
 * Each shape maps to a Rapier collider type.
 */
type ColliderShape = 'cuboid' | 'cylinder';

export interface BatchedCollider {
  shape: ColliderShape;
  position: Vec3;
  rotation: Vec3;
  /** Cuboid: [halfX, halfY, halfZ]. Cylinder: [halfHeight, radius, 0]. */
  args: Vec3;
}

export interface ColliderBatchGroup {
  shape: ColliderShape;
  colliders: BatchedCollider[];
}

/**
 * Groups static MapBlocks into ColliderBatchGroups — one group per collider shape.
 * Each group becomes a single Rapier RigidBody with multiple child colliders,
 * reducing ~N RigidBodies to ~2 (one for cuboids, one for cylinders).
 *
 * Blocks with shape 'box', 'ramp', or 'wedge' all use cuboid colliders.
 * Blocks with shape 'cylinder' use cylinder colliders.
 */
export function batchStaticColliders(blocks: ReadonlyArray<MapBlock>): ColliderBatchGroup[] {
  const cuboids: BatchedCollider[] = [];
  const cylinders: BatchedCollider[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const halfX = block.size[0] / 2;
    const halfY = block.size[1] / 2;
    const halfZ = block.size[2] / 2;
    const rot = block.rotation ?? _zeroRot;

    if (block.shape === 'cylinder') {
      cylinders.push({
        shape: 'cylinder',
        position: block.position,
        rotation: rot,
        args: [halfY, halfX, 0],
      });
    } else {
      cuboids.push({
        shape: 'cuboid',
        position: block.position,
        rotation: rot,
        args: [halfX, halfY, halfZ],
      });
    }
  }

  const groups: ColliderBatchGroup[] = [];

  // Split into chunks of MAX_COLLIDERS_PER_BODY to preserve floating-point precision
  // in Rapier's broad-phase. Large compound bodies with distant children lose accuracy.
  const MAX_COLLIDERS_PER_BODY = 64;
  for (let i = 0; i < cuboids.length; i += MAX_COLLIDERS_PER_BODY) {
    groups.push({ shape: 'cuboid', colliders: cuboids.slice(i, i + MAX_COLLIDERS_PER_BODY) });
  }
  for (let i = 0; i < cylinders.length; i += MAX_COLLIDERS_PER_BODY) {
    groups.push({ shape: 'cylinder', colliders: cylinders.slice(i, i + MAX_COLLIDERS_PER_BODY) });
  }
  return groups;
}

const _zeroRot: Vec3 = [0, 0, 0];
