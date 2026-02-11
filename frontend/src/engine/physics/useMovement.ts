/**
 * Core Quake-style ground/air movement — friction, acceleration, wish direction.
 *
 * Depends on: ENGINE_PHYSICS constants
 * Used by: game physics tick (usePhysicsTick)
 */
import { Vector3 } from 'three';
import { ENGINE_PHYSICS as PHYSICS } from './constants';

const _wishDir = new Vector3();

const FRICTION_DEAD_ZONE = 0.1;
const FRICTION_DEAD_ZONE_SQ = FRICTION_DEAD_ZONE * FRICTION_DEAD_ZONE;

/**
 * Apply ground friction to velocity (horizontal only).
 * Enhanced Quake friction model with direction-aware deceleration:
 * - Counter-strafing (input opposing velocity) uses higher GROUND_DECEL for snappy stops
 * - No input or same-direction input uses standard GROUND_FRICTION
 */
export function applyFriction(
  velocity: Vector3,
  dt: number,
  hasInput?: boolean,
  wishDir?: Vector3,
): void {
  const speedSq = velocity.x * velocity.x + velocity.z * velocity.z;
  if (speedSq < FRICTION_DEAD_ZONE_SQ) {
    velocity.x = 0;
    velocity.z = 0;
    return;
  }
  const speed = Math.sqrt(speedSq);

  // Detect counter-strafe: input direction opposes current velocity
  let friction = PHYSICS.GROUND_FRICTION;
  if (hasInput && wishDir && wishDir.lengthSq() > 0) {
    const dot = (velocity.x * wishDir.x + velocity.z * wishDir.z) / speed;
    if (dot < -0.5) {
      // Counter-strafing — use heavier decel for snappy direction changes
      friction = PHYSICS.GROUND_FRICTION + PHYSICS.GROUND_DECEL;
    }
  }

  const control = speed < PHYSICS.STOP_SPEED ? PHYSICS.STOP_SPEED : speed;
  const drop = control * friction * dt;

  let newSpeed = speed - drop;
  if (newSpeed < 0) newSpeed = 0;
  const scale = newSpeed / speed;

  velocity.x *= scale;
  velocity.z *= scale;
}

/**
 * Apply ground acceleration toward wish direction.
 * Standard Quake accelerate function.
 */
export function applyGroundAcceleration(
  velocity: Vector3,
  wishDir: Vector3,
  dt: number,
  speedMult = 1,
): void {
  const wishSpeed = PHYSICS.GROUND_MAX_SPEED * speedMult;
  const currentSpeed = velocity.x * wishDir.x + velocity.z * wishDir.z;
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return;

  let accelSpeed = PHYSICS.GROUND_ACCEL * wishSpeed * dt;
  if (accelSpeed > addSpeed) accelSpeed = addSpeed;

  velocity.x += accelSpeed * wishDir.x;
  velocity.z += accelSpeed * wishDir.z;
}

/**
 * Apply Quake-style air acceleration.
 * This is THE key mechanic for strafe jumping.
 *
 * The wish speed is capped at AIR_SPEED_CAP (~30), but there is no cap
 * on total velocity. This means skilled players can reach extreme speeds
 * by air strafing correctly.
 */
export function applyAirAcceleration(
  velocity: Vector3,
  wishDir: Vector3,
  dt: number,
  speedMult = 1,
): void {
  const wishSpeed = Math.min(PHYSICS.GROUND_MAX_SPEED * speedMult, PHYSICS.AIR_SPEED_CAP * speedMult);
  const currentSpeed = velocity.x * wishDir.x + velocity.z * wishDir.z;
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return;

  let accelSpeed = PHYSICS.AIR_ACCEL * wishSpeed * dt;
  if (accelSpeed > addSpeed) accelSpeed = addSpeed;

  velocity.x += accelSpeed * wishDir.x;
  velocity.z += accelSpeed * wishDir.z;
}

/**
 * Compute the wish direction from input and yaw angle.
 * Returns a normalized horizontal direction vector.
 *
 * WARNING: Returns a shared module-level Vector3 reference (_wishDir).
 * The value is overwritten on every call. Use .clone() or .copy() if
 * you need to persist the result beyond the current tick.
 */
export function getWishDir(
  forward: boolean,
  backward: boolean,
  left: boolean,
  right: boolean,
  yaw: number,
): Vector3 {
  _wishDir.set(0, 0, 0);

  // Compute input direction in local space
  let fx = 0, fz = 0;
  if (forward) fz -= 1;
  if (backward) fz += 1;
  if (left) fx -= 1;
  if (right) fx += 1;

  if (fx === 0 && fz === 0) return _wishDir;

  // Rotate by yaw to get world-space direction
  // Three.js Y rotation: forward = (-sin(yaw), 0, -cos(yaw)), right = (cos(yaw), 0, -sin(yaw))
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  _wishDir.x = fx * cosYaw + fz * sinYaw;
  _wishDir.z = -fx * sinYaw + fz * cosYaw;
  _wishDir.normalize();

  return _wishDir;
}

/**
 * Apply reduced friction for crouch sliding.
 * Same Quake friction model but with CROUCH_FRICTION instead of GROUND_FRICTION.
 */
export function applySlideFriction(velocity: Vector3, dt: number): void {
  const speedSq = velocity.x * velocity.x + velocity.z * velocity.z;
  if (speedSq < FRICTION_DEAD_ZONE_SQ) {
    velocity.x = 0;
    velocity.z = 0;
    return;
  }
  const speed = Math.sqrt(speedSq);

  const control = speed < PHYSICS.STOP_SPEED ? PHYSICS.STOP_SPEED : speed;
  const drop = control * PHYSICS.CROUCH_FRICTION * dt;

  let newSpeed = speed - drop;
  if (newSpeed < 0) newSpeed = 0;
  const scale = newSpeed / speed;

  velocity.x *= scale;
  velocity.z *= scale;
}

/**
 * Apply Quake-style slope gravity to grounded velocity.
 *
 * Projects gravity along the slope surface:
 * - Uphill: parallel component opposes movement → deceleration
 * - Downhill: parallel component aids movement → acceleration
 * - Flat: near-zero effect (skipped below minAngleDeg)
 *
 * Works WITH normal ground friction (unlike surf physics which has zero friction).
 * Apply BEFORE friction/accel in the grounded branch.
 */
export function applySlopeGravity(
  velocity: Vector3,
  normalX: number,
  normalY: number,
  normalZ: number,
  gravity: number,
  dt: number,
  scale: number,
  minAngleDeg: number,
): void {
  const angleDeg = Math.acos(Math.min(normalY, 1.0)) * (180 / Math.PI);
  if (angleDeg < minAngleDeg) return;

  // Gravity vector: g = (0, -gravity * dt, 0)
  // Project onto surface plane: gParallel = g - (g·n)·n
  const gY = -gravity * dt;
  const gDotN = gY * normalY; // g · n = -gravity*dt * normalY

  velocity.x += (0 - gDotN * normalX) * scale;
  velocity.y += (gY - gDotN * normalY) * scale;
  velocity.z += (0 - gDotN * normalZ) * scale;
}

/**
 * Get horizontal speed from velocity.
 */
export function getHorizontalSpeed(velocity: Vector3): number {
  return Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
}
