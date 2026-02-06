import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  applyFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  getWishDir,
  getHorizontalSpeed,
} from './useMovement';
import { PHYSICS } from './constants';

const dt = PHYSICS.TICK_DELTA;

describe('applyFriction', () => {
  it('snaps near-zero velocity to zero', () => {
    const vel = new Vector3(0.05, 0, 0.05);
    applyFriction(vel, dt);
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
  });

  it('reduces velocity over time', () => {
    const vel = new Vector3(200, 0, 0);
    const before = vel.x;
    applyFriction(vel, dt);
    expect(vel.x).toBeLessThan(before);
    expect(vel.x).toBeGreaterThan(0);
  });

  it('does not affect vertical velocity', () => {
    const vel = new Vector3(100, 50, 0);
    applyFriction(vel, dt);
    expect(vel.y).toBe(50);
  });

  it('applies stop-speed control for slow velocities', () => {
    const vel = new Vector3(50, 0, 0);
    applyFriction(vel, dt);
    // At speed < STOP_SPEED, friction uses STOP_SPEED as control
    // drop = STOP_SPEED * friction * dt = 100 * 6 * (1/128) ≈ 4.6875
    // newSpeed = 50 - 4.6875 ≈ 45.3
    expect(vel.x).toBeCloseTo(45.3125, 2);
  });
});

describe('applyGroundAcceleration', () => {
  it('accelerates from standstill', () => {
    const vel = new Vector3(0, 0, 0);
    const wishDir = new Vector3(1, 0, 0);
    applyGroundAcceleration(vel, wishDir, dt);
    expect(vel.x).toBeGreaterThan(0);
  });

  it('does not exceed max ground speed', () => {
    const vel = new Vector3(PHYSICS.GROUND_MAX_SPEED, 0, 0);
    const wishDir = new Vector3(1, 0, 0);
    applyGroundAcceleration(vel, wishDir, dt);
    expect(vel.x).toBe(PHYSICS.GROUND_MAX_SPEED);
  });

  it('does not accelerate against wish direction', () => {
    const vel = new Vector3(PHYSICS.GROUND_MAX_SPEED + 100, 0, 0);
    const wishDir = new Vector3(1, 0, 0);
    const before = vel.x;
    applyGroundAcceleration(vel, wishDir, dt);
    expect(vel.x).toBe(before);
  });
});

describe('applyAirAcceleration', () => {
  it('adds speed in wish direction when airborne', () => {
    const vel = new Vector3(300, 0, 0);
    const wishDir = new Vector3(0, 0, 1); // strafe perpendicular
    applyAirAcceleration(vel, wishDir, dt);
    expect(vel.z).toBeGreaterThan(0);
  });

  it('caps forward air speed at AIR_SPEED_CAP', () => {
    const vel = new Vector3(0, 0, 0);
    const wishDir = new Vector3(1, 0, 0);

    // Accelerating in a single direction caps at AIR_SPEED_CAP (this is correct Quake behavior)
    for (let i = 0; i < 1000; i++) {
      applyAirAcceleration(vel, wishDir, dt);
    }
    // Forward-only air accel converges to AIR_SPEED_CAP
    expect(vel.x).toBeCloseTo(PHYSICS.AIR_SPEED_CAP, 0);
  });

  it('gains speed via strafe acceleration beyond AIR_SPEED_CAP', () => {
    const vel = new Vector3(PHYSICS.AIR_SPEED_CAP, 0, 0);

    // Strafe perpendicular to current velocity — this is how players gain speed in Quake
    for (let i = 0; i < 100; i++) {
      const wishDir = new Vector3(0, 0, 1); // pure strafe
      applyAirAcceleration(vel, wishDir, dt);
    }
    // Total speed should exceed AIR_SPEED_CAP via strafe acceleration
    expect(getHorizontalSpeed(vel)).toBeGreaterThan(PHYSICS.AIR_SPEED_CAP);
  });

  it('allows strafe jumping to exceed ground max speed', () => {
    const vel = new Vector3(400, 0, 0); // already above ground max
    // Strafe perpendicular to velocity — currentSpeed dot product is 0
    const wishDir = new Vector3(0, 0, 1);
    const before = getHorizontalSpeed(vel);
    applyAirAcceleration(vel, wishDir, dt);
    const after = getHorizontalSpeed(vel);
    // Air accel should still add speed even above GROUND_MAX_SPEED
    expect(after).toBeGreaterThan(before);
  });
});

describe('getWishDir', () => {
  it('returns zero when no input', () => {
    const dir = getWishDir(false, false, false, false, 0);
    expect(dir.length()).toBe(0);
  });

  it('returns forward direction at yaw 0', () => {
    const dir = getWishDir(true, false, false, false, 0);
    expect(dir.z).toBeLessThan(0); // forward = negative Z
    expect(Math.abs(dir.x)).toBeLessThan(0.001);
  });

  it('normalizes diagonal input', () => {
    const dir = getWishDir(true, false, true, false, 0);
    expect(dir.length()).toBeCloseTo(1, 5);
  });

  it('rotates with yaw', () => {
    const dir0 = getWishDir(true, false, false, false, 0).clone();
    const dir90 = getWishDir(true, false, false, false, Math.PI / 2).clone();
    // At yaw=0, forward → (0, 0, -1)
    // At yaw=π/2, forward → (1, 0, 0)
    // dir90.x should equal -dir0.z (rotation by 90 degrees)
    expect(dir90.x).toBeCloseTo(-dir0.z, 3);
    expect(dir90.z).toBeCloseTo(dir0.x, 3);
  });
});

describe('getHorizontalSpeed', () => {
  it('ignores vertical component', () => {
    const vel = new Vector3(3, 100, 4);
    expect(getHorizontalSpeed(vel)).toBeCloseTo(5);
  });

  it('returns 0 for stationary', () => {
    expect(getHorizontalSpeed(new Vector3(0, 0, 0))).toBe(0);
  });
});
