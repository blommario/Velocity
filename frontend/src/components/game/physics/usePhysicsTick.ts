import { type MutableRefObject } from 'react';
import { Vector3, type Camera } from 'three';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
import { PHYSICS } from './constants';
import type { InputState } from './types';
import {
  applyFriction,
  applySlideFriction,
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

export interface PhysicsTickRefs {
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
  isCrouching: MutableRefObject<boolean>;
  isSliding: MutableRefObject<boolean>;
  input: MutableRefObject<InputState>;
}

/** Execute a single 128Hz physics tick: respawn → mouse look → movement → KCC → camera → HUD */
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

  // --- Respawn check ---
  const store = useGameStore.getState();
  if (store.checkKillZone()) {
    store.requestRespawn();
  }
  const respawn = store.consumeRespawn();
  if (respawn) {
    rb.setNextKinematicTranslation({ x: respawn.pos[0], y: respawn.pos[1], z: respawn.pos[2] });
    _newPos.set(respawn.pos[0], respawn.pos[1], respawn.pos[2]);
    velocity.set(0, 0, 0);
    refs.yaw.current = respawn.yaw;
    refs.pitch.current = 0;
    refs.grounded.current = false;
    refs.isCrouching.current = false;
    refs.isSliding.current = false;
    collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
    camera.position.set(respawn.pos[0], respawn.pos[1] + PHYSICS.PLAYER_EYE_OFFSET, respawn.pos[2]);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = respawn.yaw;
    camera.rotation.x = 0;
    return;
  }

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

  // --- Crouch sliding ---
  const wantsCrouch = input.crouch;
  const hSpeed = getHorizontalSpeed(velocity);

  if (refs.grounded.current && wantsCrouch) {
    if (!refs.isCrouching.current && hSpeed >= PHYSICS.CROUCH_SLIDE_MIN_SPEED) {
      refs.isSliding.current = true;
      const boost = PHYSICS.CROUCH_SLIDE_BOOST;
      if (hSpeed > 0) {
        velocity.x += (velocity.x / hSpeed) * boost;
        velocity.z += (velocity.z / hSpeed) * boost;
      }
    }
    refs.isCrouching.current = true;
    if (refs.isSliding.current && hSpeed < PHYSICS.CROUCH_SLIDE_MIN_SPEED * 0.5) {
      refs.isSliding.current = false;
    }
  } else {
    refs.isCrouching.current = wantsCrouch && !refs.grounded.current;
    refs.isSliding.current = false;
  }

  const targetHalfHeight = refs.isCrouching.current
    ? PHYSICS.PLAYER_HEIGHT_CROUCH / 2 - PHYSICS.PLAYER_RADIUS
    : PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS;
  collider.setHalfHeight(targetHalfHeight);

  // --- Movement ---
  if (refs.grounded.current) {
    if (wantsJump) {
      velocity.y = PHYSICS.JUMP_FORCE;
      refs.grounded.current = false;
      refs.jumpBufferTime.current = 0;
      refs.isSliding.current = false;
      refs.isCrouching.current = false;
      collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
      store.recordJump();
      if (hasInput) applyAirAcceleration(velocity, wishDir, dt);
    } else if (refs.isSliding.current) {
      applySlideFriction(velocity, dt);
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
  const eyeOffset = refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;
  camera.position.set(_newPos.x, _newPos.y + eyeOffset, _newPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = refs.yaw.current;
  camera.rotation.x = refs.pitch.current;

  // --- HUD (throttled ~30Hz) ---
  const now = performance.now();
  if (now - lastHudUpdate > HUD_UPDATE_INTERVAL) {
    lastHudUpdate = now;
    const speed = getHorizontalSpeed(velocity);
    store.updateHud(speed, [_newPos.x, _newPos.y, _newPos.z], refs.grounded.current);
    if (store.timerRunning) store.tickTimer();
  }
}
