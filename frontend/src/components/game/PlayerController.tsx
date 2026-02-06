import { useRef, useEffect, useCallback } from 'react';
import { Vector3 } from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import {
  RigidBody,
  CapsuleCollider,
  useRapier,
  useBeforePhysicsStep,
} from '@react-three/rapier';
import type {
  RapierRigidBody,
  RapierCollider,
} from '@react-three/rapier';
import { PHYSICS, DEG2RAD } from './physics/constants';
import { useInputBuffer } from './physics/useInputBuffer';
import {
  applyFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  getWishDir,
  getHorizontalSpeed,
} from './physics/useMovement';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';

const HALF_PI = Math.PI / 2 - 0.01;
const _desiredTranslation = new Vector3();
const _correctedMovement = new Vector3();
const _newPos = new Vector3();

// Throttle HUD updates to ~30Hz
let lastHudUpdate = 0;
const HUD_UPDATE_INTERVAL = 1000 / 30;

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
    const rb = rigidBodyRef.current;
    const collider = colliderRef.current;
    const controller = controllerRef.current;
    if (!rb || !collider || !controller) return;

    const input = inputRef.current;
    const velocity = velocityRef.current;
    const sensitivity = useSettingsStore.getState().sensitivity;
    const autoBhop = useSettingsStore.getState().autoBhop;
    const dt = PHYSICS.TICK_DELTA;

    // --- Mouse look ---
    const { dx, dy } = consumeMouseDelta();
    yawRef.current -= dx * sensitivity;
    pitchRef.current -= dy * sensitivity;
    pitchRef.current = Math.max(-HALF_PI, Math.min(HALF_PI, pitchRef.current));

    // --- Compute wish direction ---
    const wishDir = getWishDir(
      input.forward, input.backward,
      input.left, input.right,
      yawRef.current,
    );
    const hasInput = wishDir.lengthSq() > 0;

    // --- Jump buffer ---
    if (input.jump) {
      jumpBufferTimeRef.current = PHYSICS.JUMP_BUFFER_MS;
    } else if (jumpBufferTimeRef.current > 0) {
      jumpBufferTimeRef.current -= dt * 1000;
    }

    const wantsJump = autoBhop ? input.jump : jumpBufferTimeRef.current > 0;

    // --- Movement ---
    if (groundedRef.current) {
      if (wantsJump) {
        // Jump: immediate vertical velocity, skip friction this frame
        velocity.y = PHYSICS.JUMP_FORCE;
        groundedRef.current = false;
        jumpBufferTimeRef.current = 0;

        // Still apply air acceleration on the jump frame
        if (hasInput) {
          applyAirAcceleration(velocity, wishDir, dt);
        }
      } else {
        // Ground movement
        applyFriction(velocity, dt);
        if (hasInput) {
          applyGroundAcceleration(velocity, wishDir, dt);
        }
      }
    } else {
      // Air movement — the core of strafe jumping
      if (hasInput) {
        applyAirAcceleration(velocity, wishDir, dt);
      }
      // Apply gravity
      velocity.y -= PHYSICS.GRAVITY * dt;
    }

    // --- Apply movement via character controller ---
    _desiredTranslation.copy(velocity).multiplyScalar(dt);

    controller.computeColliderMovement(collider, _desiredTranslation);

    const movement = controller.computedMovement();
    _correctedMovement.set(movement.x, movement.y, movement.z);

    // Update position
    const pos = rb.translation();
    _newPos.set(
      pos.x + _correctedMovement.x,
      pos.y + _correctedMovement.y,
      pos.z + _correctedMovement.z,
    );
    rb.setNextKinematicTranslation(_newPos);

    // --- Ground detection ---
    groundedRef.current = controller.computedGrounded();

    // --- Correct velocity based on collisions ---
    // If we hit a ceiling, zero vertical velocity
    if (velocity.y > 0 && _correctedMovement.y < _desiredTranslation.y * 0.5) {
      velocity.y = 0;
    }
    // If we landed, zero vertical velocity
    if (groundedRef.current && velocity.y < 0) {
      velocity.y = 0;
    }

    // --- Update camera position ---
    camera.position.set(
      _newPos.x,
      _newPos.y + PHYSICS.PLAYER_EYE_OFFSET,
      _newPos.z,
    );

    // Apply rotation to camera
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yawRef.current;
    camera.rotation.x = pitchRef.current;

    // --- Throttled HUD updates ---
    const now = performance.now();
    if (now - lastHudUpdate > HUD_UPDATE_INTERVAL) {
      lastHudUpdate = now;
      const speed = getHorizontalSpeed(velocity);
      const store = useGameStore.getState();
      store.setSpeed(speed);
      store.setPosition([_newPos.x, _newPos.y, _newPos.z]);
      store.setGrounded(groundedRef.current);
      if (store.timerRunning) {
        store.tickTimer();
      }
    }
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
