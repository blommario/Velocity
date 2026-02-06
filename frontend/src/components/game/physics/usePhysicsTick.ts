import { type MutableRefObject } from 'react';
import { Vector3, type Camera } from 'three';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
import { PHYSICS } from './constants';
import type { InputState } from './types';
import {
  applyFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  getWishDir,
  getHorizontalSpeed,
} from './useMovement';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';

const MAX_PITCH = Math.PI / 2 - 0.01;
const HUD_UPDATE_HZ = 30;
const HUD_UPDATE_INTERVAL = 1000 / HUD_UPDATE_HZ;

// Reusable vectors to avoid per-tick allocations
const _desiredTranslation = new Vector3();
const _correctedMovement = new Vector3();
const _newPos = new Vector3();

let lastHudUpdate = 0;

interface PhysicsTickRefs {
  rigidBody: MutableRefObject<RapierRigidBody | null>;
  collider: MutableRefObject<RapierCollider | null>;
  controller: MutableRefObject<ReturnType<
    import('@dimforge/rapier3d-compat').World['createCharacterController']
  > | null>;
  velocity: MutableRefObject<Vector3>;
  yaw: MutableRefObject<number>;
  pitch: MutableRefObject<number>;
  grounded: MutableRefObject<boolean>;
  jumpBufferTime: MutableRefObject<number>;
  input: MutableRefObject<InputState>;
}

/** Execute a single 128Hz physics tick: mouse look → movement → KCC → camera → HUD */
export function physicsTick(
  refs: PhysicsTickRefs,
  camera: Camera,
  consumeMouseDelta: () => { dx: number; dy: number },
): void {
  const rb = refs.rigidBody.current;
  const collider = refs.collider.current;
  const controller = refs.controller.current;
  if (!rb || !collider || !controller) return;

  const input = refs.input.current;
  const velocity = refs.velocity.current;
  const { sensitivity, autoBhop } = useSettingsStore.getState();
  const dt = PHYSICS.TICK_DELTA;

  // --- Mouse look ---
  const { dx, dy } = consumeMouseDelta();
  refs.yaw.current -= dx * sensitivity;
  refs.pitch.current -= dy * sensitivity;
  refs.pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, refs.pitch.current));

  // --- Wish direction ---
  const wishDir = getWishDir(
    input.forward, input.backward,
    input.left, input.right,
    refs.yaw.current,
  );
  const hasInput = wishDir.lengthSq() > 0;

  // --- Jump buffer ---
  if (input.jump) {
    refs.jumpBufferTime.current = PHYSICS.JUMP_BUFFER_MS;
  } else if (refs.jumpBufferTime.current > 0) {
    refs.jumpBufferTime.current -= dt * 1000;
  }

  const wantsJump = autoBhop ? input.jump : refs.jumpBufferTime.current > 0;

  // --- Movement ---
  if (refs.grounded.current) {
    if (wantsJump) {
      velocity.y = PHYSICS.JUMP_FORCE;
      refs.grounded.current = false;
      refs.jumpBufferTime.current = 0;
      if (hasInput) applyAirAcceleration(velocity, wishDir, dt);
    } else {
      applyFriction(velocity, dt);
      if (hasInput) applyGroundAcceleration(velocity, wishDir, dt);
    }
  } else {
    if (hasInput) applyAirAcceleration(velocity, wishDir, dt);
    velocity.y -= PHYSICS.GRAVITY * dt;
  }

  // --- Character controller ---
  _desiredTranslation.copy(velocity).multiplyScalar(dt);
  controller.computeColliderMovement(collider, _desiredTranslation);

  const movement = controller.computedMovement();
  _correctedMovement.set(movement.x, movement.y, movement.z);

  const pos = rb.translation();
  _newPos.set(
    pos.x + _correctedMovement.x,
    pos.y + _correctedMovement.y,
    pos.z + _correctedMovement.z,
  );
  rb.setNextKinematicTranslation(_newPos);

  // --- Ground detection ---
  refs.grounded.current = controller.computedGrounded();

  // --- Collision velocity correction ---
  if (velocity.y > 0 && _correctedMovement.y < _desiredTranslation.y * 0.5) {
    velocity.y = 0;
  }
  if (refs.grounded.current && velocity.y < 0) {
    velocity.y = 0;
  }

  // --- Camera ---
  camera.position.set(_newPos.x, _newPos.y + PHYSICS.PLAYER_EYE_OFFSET, _newPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = refs.yaw.current;
  camera.rotation.x = refs.pitch.current;

  // --- HUD (throttled ~30Hz) ---
  const now = performance.now();
  if (now - lastHudUpdate > HUD_UPDATE_INTERVAL) {
    lastHudUpdate = now;
    const speed = getHorizontalSpeed(velocity);
    const store = useGameStore.getState();
    store.updateHud(speed, [_newPos.x, _newPos.y, _newPos.z], refs.grounded.current);
    if (store.timerRunning) store.tickTimer();
  }
}
