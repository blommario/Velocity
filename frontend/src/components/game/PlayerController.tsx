import { useRef, useEffect } from 'react';
import { Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import {
  RigidBody,
  CapsuleCollider,
  useRapier,
  useBeforePhysicsStep,
} from '@react-three/rapier';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
import { PHYSICS, DEG2RAD } from './physics/constants';
import { useInputBuffer } from './physics/useInputBuffer';
import { physicsTick } from './physics/usePhysicsTick';

export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const { world } = useRapier();
  const { camera } = useThree();

  const velocityRef = useRef(new Vector3(0, 0, 0));
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const groundedRef = useRef(false);
  const jumpBufferTimeRef = useRef(0);
  const isCrouchingRef = useRef(false);
  const isSlidingRef = useRef(false);

  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);

  const { inputRef, consumeMouseDelta } = useInputBuffer();

  // Create the kinematic character controller
  useEffect(() => {
    const controller = world.createCharacterController(0.01);
    controller.enableAutostep(PHYSICS.STAIR_STEP_HEIGHT, PHYSICS.PLAYER_RADIUS * 0.5, true);
    controller.setMaxSlopeClimbAngle(PHYSICS.MAX_SLOPE_ANGLE * DEG2RAD);
    controller.enableSnapToGround(PHYSICS.PLAYER_RADIUS);
    controllerRef.current = controller;

    return () => {
      world.removeCharacterController(controller);
    };
  }, [world]);

  // Physics tick — runs at 128Hz
  useBeforePhysicsStep(() => {
    physicsTick(
      {
        rigidBody: rigidBodyRef,
        collider: colliderRef,
        controller: controllerRef,
        velocity: velocityRef,
        yaw: yawRef,
        pitch: pitchRef,
        grounded: groundedRef,
        jumpBufferTime: jumpBufferTimeRef,
        isCrouching: isCrouchingRef,
        isSliding: isSlidingRef,
        input: inputRef,
      },
      camera,
      consumeMouseDelta,
    );
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, 3, 0]}
      lockRotations
    >
      <CapsuleCollider
        ref={colliderRef}
        args={[PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS, PHYSICS.PLAYER_RADIUS]}
      />
    </RigidBody>
  );
}
