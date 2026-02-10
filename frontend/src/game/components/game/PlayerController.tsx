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
import { useInputBuffer } from '@engine/input/useInputBuffer';
import { physicsTick } from './physics/usePhysicsTick';
import { useGameStore } from '@game/stores/gameStore';
import { devLog, frameTiming } from '@engine/stores/devLogStore';

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
  const coyoteTimeRef = useRef(0);
  const jumpHoldTimeRef = useRef(0);
  const isJumpingRef = useRef(false);
  const isCrouchingRef = useRef(false);
  const isSlidingRef = useRef(false);

  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);

  const { inputRef, consumeMouseDelta } = useInputBuffer();

  // Create the kinematic character controller
  useEffect(() => {
    const controller = world.createCharacterController(PHYSICS.SKIN_WIDTH);
    controller.enableAutostep(PHYSICS.STAIR_STEP_HEIGHT, PHYSICS.PLAYER_RADIUS * 0.5, true);
    controller.setMaxSlopeClimbAngle(PHYSICS.MAX_SLOPE_ANGLE * DEG2RAD);
    controller.enableSnapToGround(PHYSICS.SNAP_TO_GROUND_DIST);
    controllerRef.current = controller;
    devLog.success('Physics', `CharacterController created (skinWidth=${PHYSICS.SKIN_WIDTH})`);

    return () => {
      world.removeCharacterController(controller);
    };
  }, [world]);

  // Physics tick — runs at 128Hz
  useBeforePhysicsStep(() => {
    frameTiming.begin('Physics');
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
        coyoteTime: coyoteTimeRef,
        jumpHoldTime: jumpHoldTimeRef,
        isJumping: isJumpingRef,
        isCrouching: isCrouchingRef,
        isSliding: isSlidingRef,
        input: inputRef,
      },
      camera,
      consumeMouseDelta,
      world,
    );
    frameTiming.end('Physics');
  });

  const spawnPos = useGameStore((s) => s.lastCheckpointPos) ?? [0, 3, 0];

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      position={spawnPos}
      lockRotations
    >
      <CapsuleCollider
        ref={colliderRef}
        args={[PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS, PHYSICS.PLAYER_RADIUS]}
      />
    </RigidBody>
  );
}
