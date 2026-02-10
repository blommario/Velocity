/**
 * Physics tick state definitions -- mutable state struct (PhysicsTickState), refs interface, TickContext, and active-instance registry for the 128Hz physics loop.
 * Depends on: engine scopeSway, engine recoil, @dimforge/rapier3d-compat, Three.js
 * Used by: PlayerController, all physics tick modules (cameraTick, combatTick, movementTick, etc.)
 */
import { type MutableRefObject } from 'react';
import { Vector3, type Camera } from 'three';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
import type { WallRunState } from '@engine/physics/useAdvancedMovement';
import type { InputState } from './types';
import { createScopeSwayState, resetScopeSwayState } from '@engine/physics/scopeSway';
import { resetRecoilState, type RecoilState } from '@engine/physics/recoil';
import { resetReloadTickState } from './combatTick';
import { resetWeaponWheelState } from './respawnAndInput';

// ── Physics tick state — single struct replaces ~30 let vars ──

export interface PhysicsTickState {
  lastHudUpdate: number;
  lastScopeSwayUpdate: number;
  lastDevLogUpdate: number;
  lastDevSpeedMult: number;
  lastDevGravMult: number;
  wallRunState: WallRunState;
  wasGrapplePressed: boolean;
  wasAltFire: boolean;
  adsProgress: number;
  inspectProgress: number;
  cameraTilt: number;
  landingDip: number;
  storedGroundNormal: [number, number, number] | null;
  storedGroundNormalY: number;
  respawnGraceTicks: number;
  wasGrounded: boolean;
  footstepTimer: number;
  mantleTimer: number;
  mantleCooldown: number;
  mantleTargetY: number;
  mantleStartY: number;
  mantleFwdX: number;
  mantleFwdZ: number;
  // Stances
  slideTimer: number;
  proneTransition: number;
  proneTransitionTarget: boolean;
  lastCrouchPress: number;
  slidePitchOffset: number;
  // Bunny hop timing
  lastLandingTime: number;
  bhopPerfect: boolean;
  // Dash / dodge
  lastLeftPress: number;
  lastRightPress: number;
  dashCooldown: number;
  dashTimer: number;
  dashDirX: number;
  dashDirZ: number;
  // Grapple timing
  grappleAttachTime: number;
}

export function createPhysicsTickState(): PhysicsTickState {
  return {
    lastHudUpdate: 0,
    lastScopeSwayUpdate: 0,
    lastDevLogUpdate: 0,
    lastDevSpeedMult: 1.0,
    lastDevGravMult: 1.0,
    wallRunState: {
      isWallRunning: false,
      wallRunTime: 0,
      wallNormal: [0, 0, 0],
      lastWallNormalX: 0,
      lastWallNormalZ: 0,
      wallRunCooldown: false,
      consecutiveWallJumps: 0,
      lastWallJumpTime: 0,
    },
    wasGrapplePressed: false,
    wasAltFire: false,
    adsProgress: 0,
    inspectProgress: 0,
    cameraTilt: 0,
    landingDip: 0,
    storedGroundNormal: null,
    storedGroundNormalY: 1.0,
    respawnGraceTicks: 0,
    wasGrounded: false,
    footstepTimer: 0,
    mantleTimer: 0,
    mantleCooldown: 0,
    mantleTargetY: 0,
    mantleStartY: 0,
    mantleFwdX: 0,
    mantleFwdZ: 0,
    slideTimer: 0,
    proneTransition: 0,
    proneTransitionTarget: false,
    lastCrouchPress: 0,
    slidePitchOffset: 0,
    lastLandingTime: 0,
    bhopPerfect: false,
    lastLeftPress: 0,
    lastRightPress: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashDirX: 0,
    dashDirZ: 0,
    grappleAttachTime: 0,
  };
}

// ── Active instance registry (set by PlayerController on mount) ──

let _activeState: PhysicsTickState | null = null;
let _activeSwayState: ReturnType<typeof createScopeSwayState> | null = null;
let _activeRecoilState: RecoilState | null = null;

export function registerPhysicsTickState(
  state: PhysicsTickState,
  swayState: ReturnType<typeof createScopeSwayState>,
  recoilState?: RecoilState,
): void {
  _activeState = state;
  _activeSwayState = swayState;
  _activeRecoilState = recoilState ?? null;
}

export function resetPhysicsTickState(): void {
  if (_activeState) Object.assign(_activeState, createPhysicsTickState());
  if (_activeSwayState) resetScopeSwayState(_activeSwayState);
  if (_activeRecoilState) resetRecoilState(_activeRecoilState);
  resetReloadTickState();
  resetWeaponWheelState();
}

// ── Refs & context interfaces ──

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
  coyoteTime: MutableRefObject<number>;
  jumpHoldTime: MutableRefObject<number>;
  isJumping: MutableRefObject<boolean>;
  isCrouching: MutableRefObject<boolean>;
  isSliding: MutableRefObject<boolean>;
  isProne: MutableRefObject<boolean>;
  input: MutableRefObject<InputState>;
}

export interface TickContext {
  s: PhysicsTickState;
  swayState: ReturnType<typeof createScopeSwayState>;
  recoilState: RecoilState;
  refs: PhysicsTickRefs;
  camera: Camera;
  rapierWorld: import('@dimforge/rapier3d-compat').World;
  rb: RapierRigidBody;
  collider: RapierCollider;
  controller: ReturnType<import('@dimforge/rapier3d-compat').World['createCharacterController']>;
  input: InputState;
  velocity: Vector3;
  dt: number;
  speedMult: number;
  gravMult: number;
  sensitivity: number;
  adsSensitivityMult: number;
  autoBhop: boolean;
  edgeGrab: boolean;
  now: number;
}
