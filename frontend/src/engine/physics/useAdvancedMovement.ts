import { Vector3 } from 'three';
import { ENGINE_PHYSICS as PHYSICS, DEG2RAD } from './constants';

const _wallNormal = new Vector3();
const _wallRight = new Vector3();
const _grappleDir = new Vector3();
const _surfNormal = new Vector3();
const _gravityVec = new Vector3();

// ── Wall Running ──

export interface WallRunState {
  isWallRunning: boolean;
  wallRunTime: number;
  wallNormal: [number, number, number];
  lastWallNormalX: number;
  lastWallNormalZ: number;
  wallRunCooldown: boolean; // can't re-run same wall without touching ground
}

export function createWallRunState(): WallRunState {
  return {
    isWallRunning: false,
    wallRunTime: 0,
    wallNormal: [0, 0, 0],
    lastWallNormalX: 0,
    lastWallNormalZ: 0,
    wallRunCooldown: false,
  };
}

/**
 * Check for wall run activation and update state.
 * Returns true if currently wall running.
 */
export function updateWallRun(
  state: WallRunState,
  velocity: Vector3,
  isGrounded: boolean,
  strafeLeft: boolean,
  strafeRight: boolean,
  hasWallLeft: boolean,
  hasWallRight: boolean,
  wallNormalX: number,
  wallNormalZ: number,
  dt: number,
): boolean {
  // Reset cooldown on ground
  if (isGrounded) {
    state.wallRunCooldown = false;
    state.isWallRunning = false;
    state.wallRunTime = 0;
    return false;
  }

  const hSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

  // Check activation conditions
  const wantsWallRunLeft = strafeLeft && hasWallLeft;
  const wantsWallRunRight = strafeRight && hasWallRight;
  const wantsWallRun = wantsWallRunLeft || wantsWallRunRight;

  if (!state.isWallRunning) {
    // Activation: in air, fast enough, strafing toward wall, not on cooldown
    if (!wantsWallRun || hSpeed < PHYSICS.WALL_RUN_MIN_SPEED || state.wallRunCooldown) {
      return false;
    }

    // Check if this is the same wall we just ran on
    const sameWall = Math.abs(wallNormalX - state.lastWallNormalX) < 0.1
      && Math.abs(wallNormalZ - state.lastWallNormalZ) < 0.1;
    if (sameWall && state.wallRunCooldown) return false;

    state.isWallRunning = true;
    state.wallRunTime = 0;
    state.wallNormal = [wallNormalX, 0, wallNormalZ];
    state.lastWallNormalX = wallNormalX;
    state.lastWallNormalZ = wallNormalZ;

    // Preserve speed on entry (scale is always WALL_RUN_SPEED_PRESERVATION since hSpeed >= MIN_SPEED)
    velocity.x *= PHYSICS.WALL_RUN_SPEED_PRESERVATION;
    velocity.z *= PHYSICS.WALL_RUN_SPEED_PRESERVATION;
  }

  // Update wall run
  state.wallRunTime += dt;
  if (state.wallRunTime >= PHYSICS.WALL_RUN_MAX_DURATION || !wantsWallRun) {
    state.isWallRunning = false;
    state.wallRunCooldown = true;
    return false;
  }

  // Reduced gravity while wall running
  velocity.y -= PHYSICS.GRAVITY * PHYSICS.WALL_RUN_GRAVITY_MULT * dt;

  return true;
}

/**
 * Wall jump: push away from wall + upward.
 */
export function wallJump(state: WallRunState, velocity: Vector3): void {
  if (!state.isWallRunning) return;

  _wallNormal.set(state.wallNormal[0], 0, state.wallNormal[2]).normalize();

  velocity.x += _wallNormal.x * PHYSICS.WALL_RUN_JUMP_FORCE_NORMAL;
  velocity.z += _wallNormal.z * PHYSICS.WALL_RUN_JUMP_FORCE_NORMAL;
  velocity.y = PHYSICS.WALL_RUN_JUMP_FORCE_UP;

  state.isWallRunning = false;
  state.wallRunCooldown = true;
}

// ── Surfing ──

/**
 * Check if a surface normal indicates a surf ramp (30-60 degrees).
 */
export function isSurfSurface(normalX: number, normalY: number, normalZ: number): boolean {
  const angle = Math.acos(normalY) / DEG2RAD;
  return angle >= PHYSICS.SURF_MIN_ANGLE && angle <= PHYSICS.SURF_MAX_ANGLE;
}

/**
 * Apply surf physics: zero friction, gravity slides along surface.
 * Clamps final speed to MAX_SPEED to prevent KCC oscillation on ramps.
 */
export function applySurfPhysics(
  velocity: Vector3,
  normalX: number,
  normalY: number,
  normalZ: number,
  dt: number,
): void {
  _surfNormal.set(normalX, normalY, normalZ).normalize();

  // Project gravity along the surface (gravity component parallel to surface)
  _gravityVec.set(0, -PHYSICS.GRAVITY * dt, 0);
  const normalComponent = _gravityVec.dot(_surfNormal);
  velocity.x += _gravityVec.x - normalComponent * _surfNormal.x;
  velocity.y += _gravityVec.y - normalComponent * _surfNormal.y;
  velocity.z += _gravityVec.z - normalComponent * _surfNormal.z;

  // Keep player on surface by removing velocity component into surface
  const velIntoSurface = velocity.dot(_surfNormal);
  if (velIntoSurface < 0) {
    velocity.x -= velIntoSurface * _surfNormal.x;
    velocity.y -= velIntoSurface * _surfNormal.y;
    velocity.z -= velIntoSurface * _surfNormal.z;
  }

  // Safety clamp — prevent surf from exceeding engine speed limit
  const surfSpeed = velocity.length();
  if (surfSpeed > PHYSICS.MAX_SPEED) {
    velocity.multiplyScalar(PHYSICS.MAX_SPEED / surfSpeed);
  }
}

// ── Grappling Hook ──

/**
 * Apply pendulum swing physics toward grapple point.
 */
export function applyGrappleSwing(
  velocity: Vector3,
  playerPos: Vector3,
  grappleTarget: [number, number, number],
  grappleLength: number,
  dt: number,
): void {
  _grappleDir.set(
    grappleTarget[0] - playerPos.x,
    grappleTarget[1] - playerPos.y,
    grappleTarget[2] - playerPos.z,
  );
  const dist = _grappleDir.length();
  if (dist < 0.1) return;
  _grappleDir.divideScalar(dist);

  // Pull force toward target
  const pullStrength = PHYSICS.GRAPPLE_PULL_FORCE * dt;
  velocity.x += _grappleDir.x * pullStrength;
  velocity.y += _grappleDir.y * pullStrength;
  velocity.z += _grappleDir.z * pullStrength;

  // Apply swing gravity (reduced)
  velocity.y -= PHYSICS.GRAPPLE_SWING_GRAVITY * dt;

  // Constrain to rope length (pendulum)
  const newDist = Math.sqrt(
    (playerPos.x + velocity.x * dt - grappleTarget[0]) ** 2 +
    (playerPos.y + velocity.y * dt - grappleTarget[1]) ** 2 +
    (playerPos.z + velocity.z * dt - grappleTarget[2]) ** 2,
  );

  if (newDist > grappleLength) {
    // Remove velocity component away from target
    const radialVel = velocity.dot(_grappleDir);
    if (radialVel < 0) {
      velocity.x -= radialVel * _grappleDir.x;
      velocity.y -= radialVel * _grappleDir.y;
      velocity.z -= radialVel * _grappleDir.z;
    }
  }
}

// ── Explosion Knockback ──

const _explosionDir = new Vector3();

/** Max velocity delta from a single explosion — prevents tunneling through walls */
const MAX_KNOCKBACK_DELTA = 250;

/** Minimum upward velocity when grounded and hit by an explosion (ungrounds the player). */
const EXPLOSION_MIN_UPLIFT = 80;

/**
 * Apply explosion knockback to player.
 * When `isGrounded` is true, ensures a minimum upward velocity so the player
 * lifts off the ground — prevents ground friction from immediately eating
 * horizontal knockback (standard Quake rocket-jump behavior).
 * Returns distance-based falloff (0–1) for damage calculation by the caller.
 */
export function applyExplosionKnockback(
  velocity: Vector3,
  playerPos: Vector3,
  explosionPos: [number, number, number],
  radius: number,
  force: number,
  baseDamage: number,
  isGrounded = false,
): number {
  _explosionDir.set(
    playerPos.x - explosionPos[0],
    playerPos.y - explosionPos[1],
    playerPos.z - explosionPos[2],
  );
  const dist = _explosionDir.length();
  if (dist >= radius || dist < 0.01) return 0;

  _explosionDir.divideScalar(dist);

  const falloff = 1 - dist / radius;
  const knockback = Math.min(force * falloff, MAX_KNOCKBACK_DELTA);

  velocity.x += _explosionDir.x * knockback;
  velocity.y += _explosionDir.y * knockback;
  velocity.z += _explosionDir.z * knockback;

  // Ensure grounded players get lifted so friction doesn't kill horizontal knockback
  if (isGrounded && velocity.y < EXPLOSION_MIN_UPLIFT) {
    velocity.y = EXPLOSION_MIN_UPLIFT;
  }

  return baseDamage * falloff;
}

// ── Boost / Launch / Speed Gate ──

/**
 * Apply boost pad velocity addition.
 */
export function applyBoostPad(
  velocity: Vector3,
  direction: [number, number, number],
  speed: number,
): void {
  velocity.x += direction[0] * speed;
  velocity.y += direction[1] * speed;
  velocity.z += direction[2] * speed;
}

/**
 * Apply launch pad: replace velocity with launch direction * speed.
 */
export function applyLaunchPad(
  velocity: Vector3,
  direction: [number, number, number],
  speed: number,
): void {
  velocity.x = direction[0] * speed;
  velocity.y = direction[1] * speed;
  velocity.z = direction[2] * speed;
}

/**
 * Apply speed gate multiplier if player is fast enough.
 * Returns true if activated.
 */
export function applySpeedGate(
  velocity: Vector3,
  multiplier: number,
  minSpeed: number,
): boolean {
  const hSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  if (hSpeed < minSpeed) return false;

  velocity.x *= multiplier;
  velocity.z *= multiplier;
  return true;
}
