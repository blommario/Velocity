/**
 * Generic trigger volume using a Rapier sensor collider.
 *
 * Depends on: @react-three/rapier
 * Used by: checkpoints, finish zones, kill zones, boost/launch pads
 */
import type { ReactNode } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';

type Vec3 = [number, number, number];

interface SensorZoneProps {
  /** World position of the zone */
  position: Vec3;
  /** Full size (width, height, depth) — halved internally for the collider */
  size: Vec3;
  /** Fired when a body enters the sensor volume */
  onEnter?: () => void;
  /** Fired when a body exits the sensor volume */
  onExit?: () => void;
  /** Extra children rendered inside the RigidBody (meshes, particles, etc.) */
  children?: ReactNode;
  /**
   * Where the position is applied:
   * - `"collider"` (default) — RigidBody at origin, CuboidCollider offset by position
   * - `"body"` — RigidBody at position, CuboidCollider at local origin
   */
  positionTarget?: 'collider' | 'body';
}

export function SensorZone({
  position,
  size,
  onEnter,
  onExit,
  children,
  positionTarget = 'collider',
}: SensorZoneProps) {
  const halfExtents: Vec3 = [size[0] / 2, size[1] / 2, size[2] / 2];
  const bodyPos = positionTarget === 'body' ? position : undefined;
  const colliderPos = positionTarget === 'collider' ? position : undefined;

  return (
    <RigidBody type="fixed" colliders={false} position={bodyPos} sensor>
      <CuboidCollider
        args={halfExtents}
        position={colliderPos}
        sensor
        onIntersectionEnter={onEnter}
        onIntersectionExit={onExit}
      />
      {children}
    </RigidBody>
  );
}
