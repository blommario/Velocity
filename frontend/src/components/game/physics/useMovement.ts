import { Vector3 } from 'three';
import { PHYSICS } from './constants';

const _wishDir = new Vector3();

const FRICTION_DEAD_ZONE = 0.1;

/**
 * Apply ground friction to velocity (horizontal only).
 * Quake friction model: if speed < stopSpeed, snap to 0.
 * Otherwise: speed -= speed * friction * dt
 */
export function applyFriction(velocity: Vector3, dt: number): void {
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  if (speed < FRICTION_DEAD_ZONE) {
    velocity.x = 0;
    velocity.z = 0;
    return;
  }

  let drop = 0;
  const control = speed < PHYSICS.STOP_SPEED ? PHYSICS.STOP_SPEED : speed;
  drop = control * PHYSICS.GROUND_FRICTION * dt;

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
): void {
  const wishSpeed = PHYSICS.GROUND_MAX_SPEED;
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
): void {
  const wishSpeed = Math.min(PHYSICS.GROUND_MAX_SPEED, PHYSICS.AIR_SPEED_CAP);
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
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  _wishDir.x = fx * cosYaw - fz * sinYaw;
  _wishDir.z = fx * sinYaw + fz * cosYaw;
  _wishDir.normalize();

  return _wishDir;
}

/**
 * Get horizontal speed from velocity.
 */
export function getHorizontalSpeed(velocity: Vector3): number {
  return Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
}
