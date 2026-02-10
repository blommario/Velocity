/**
 * Target dummy — a fixed entity with multi-zone hitbox colliders (head, torso, limbs).
 * Registers collider handles in the engine hitbox registry on mount.
 * Renders translucent visual meshes for hitbox visualization.
 * Depends on: @react-three/rapier (RigidBody, BallCollider, CuboidCollider, CapsuleCollider), hitboxRegistry, PHYSICS constants
 * Used by: TestMap, MapLoader
 */
import { useEffect, useRef } from 'react';
import { RigidBody, BallCollider, CuboidCollider, CapsuleCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { registerHitbox, unregisterEntity, type HitboxZone } from '@engine/physics/hitboxRegistry';
import { PHYSICS } from './physics/constants';
import { devLog } from '@engine/stores/devLogStore';

interface TargetDummyProps {
  position: [number, number, number];
  id: string;
}

/** Zone-to-multiplier mapping indexed by collider creation order. */
const ZONE_MAP: { zone: HitboxZone; mult: number }[] = [
  { zone: 'head', mult: PHYSICS.HITBOX_HEAD_MULT },
  { zone: 'torso', mult: PHYSICS.HITBOX_TORSO_MULT },
  { zone: 'limb', mult: PHYSICS.HITBOX_LIMB_MULT },   // left arm
  { zone: 'limb', mult: PHYSICS.HITBOX_LIMB_MULT },   // right arm
  { zone: 'limb', mult: PHYSICS.HITBOX_LIMB_MULT },   // left leg
  { zone: 'limb', mult: PHYSICS.HITBOX_LIMB_MULT },   // right leg
];

// Hitbox positions (local offsets from RigidBody origin at feet)
const HEAD_Y = 2.95;
const TORSO_Y = 2.05;
const ARM_Y = 2.1;
const ARM_X = 0.6;
const LEG_Y = 0.7;
const LEG_X = 0.25;

export function TargetDummy({ position, id }: TargetDummyProps) {
  const rbRef = useRef<RapierRigidBody>(null);

  useEffect(() => {
    const rb = rbRef.current;
    if (!rb) return;

    // Delay slightly to ensure colliders are created by Rapier
    const timer = setTimeout(() => {
      const numC = rb.numColliders();
      const handles: number[] = [];
      for (let i = 0; i < numC && i < ZONE_MAP.length; i++) {
        const collider = rb.collider(i);
        const handle = collider.handle;
        registerHitbox(handle, {
          zone: ZONE_MAP[i].zone,
          multiplier: ZONE_MAP[i].mult,
          entityId: id,
        });
        handles.push(handle);
      }
      devLog.info('Combat', `TargetDummy "${id}" registered ${handles.length} hitboxes`);
    }, 50);

    return () => {
      clearTimeout(timer);
      unregisterEntity(id);
    };
  }, [id]);

  return (
    <RigidBody ref={rbRef} type="fixed" colliders={false} position={position}>
      {/* Head — sphere */}
      <BallCollider args={[PHYSICS.DUMMY_HEAD_RADIUS]} position={[0, HEAD_Y, 0]} />
      {/* Torso — box */}
      <CuboidCollider
        args={[PHYSICS.DUMMY_TORSO_HALF_W, PHYSICS.DUMMY_TORSO_HALF_H, PHYSICS.DUMMY_TORSO_HALF_D]}
        position={[0, TORSO_Y, 0]}
      />
      {/* Left arm */}
      <CapsuleCollider
        args={[PHYSICS.DUMMY_LIMB_HALF_HEIGHT, PHYSICS.DUMMY_LIMB_RADIUS]}
        position={[-ARM_X, ARM_Y, 0]}
      />
      {/* Right arm */}
      <CapsuleCollider
        args={[PHYSICS.DUMMY_LIMB_HALF_HEIGHT, PHYSICS.DUMMY_LIMB_RADIUS]}
        position={[ARM_X, ARM_Y, 0]}
      />
      {/* Left leg */}
      <CapsuleCollider
        args={[PHYSICS.DUMMY_LIMB_HALF_HEIGHT, PHYSICS.DUMMY_LIMB_RADIUS]}
        position={[-LEG_X, LEG_Y, 0]}
      />
      {/* Right leg */}
      <CapsuleCollider
        args={[PHYSICS.DUMMY_LIMB_HALF_HEIGHT, PHYSICS.DUMMY_LIMB_RADIUS]}
        position={[LEG_X, LEG_Y, 0]}
      />

      {/* Visual meshes — translucent shapes for hitbox visualization */}
      {/* Head */}
      <mesh position={[0, HEAD_Y, 0]}>
        <sphereGeometry args={[PHYSICS.DUMMY_HEAD_RADIUS, 12, 8]} />
        <meshStandardMaterial color="#ff4444" transparent opacity={0.5} wireframe />
      </mesh>
      {/* Torso */}
      <mesh position={[0, TORSO_Y, 0]}>
        <boxGeometry args={[PHYSICS.DUMMY_TORSO_HALF_W * 2, PHYSICS.DUMMY_TORSO_HALF_H * 2, PHYSICS.DUMMY_TORSO_HALF_D * 2]} />
        <meshStandardMaterial color="#ffcc22" transparent opacity={0.4} wireframe />
      </mesh>
      {/* Left arm */}
      <mesh position={[-ARM_X, ARM_Y, 0]}>
        <capsuleGeometry args={[PHYSICS.DUMMY_LIMB_RADIUS, PHYSICS.DUMMY_LIMB_HALF_HEIGHT * 2, 4, 6]} />
        <meshStandardMaterial color="#4488ff" transparent opacity={0.4} wireframe />
      </mesh>
      {/* Right arm */}
      <mesh position={[ARM_X, ARM_Y, 0]}>
        <capsuleGeometry args={[PHYSICS.DUMMY_LIMB_RADIUS, PHYSICS.DUMMY_LIMB_HALF_HEIGHT * 2, 4, 6]} />
        <meshStandardMaterial color="#4488ff" transparent opacity={0.4} wireframe />
      </mesh>
      {/* Left leg */}
      <mesh position={[-LEG_X, LEG_Y, 0]}>
        <capsuleGeometry args={[PHYSICS.DUMMY_LIMB_RADIUS, PHYSICS.DUMMY_LIMB_HALF_HEIGHT * 2, 4, 6]} />
        <meshStandardMaterial color="#4488ff" transparent opacity={0.4} wireframe />
      </mesh>
      {/* Right leg */}
      <mesh position={[LEG_X, LEG_Y, 0]}>
        <capsuleGeometry args={[PHYSICS.DUMMY_LIMB_RADIUS, PHYSICS.DUMMY_LIMB_HALF_HEIGHT * 2, 4, 6]} />
        <meshStandardMaterial color="#4488ff" transparent opacity={0.4} wireframe />
      </mesh>

      {/* Center post for stability visual */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3.2, 6]} />
        <meshStandardMaterial color="#888888" transparent opacity={0.3} />
      </mesh>
    </RigidBody>
  );
}
