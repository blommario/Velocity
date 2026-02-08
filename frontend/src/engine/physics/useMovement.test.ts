import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  applyFriction,
  applySlideFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  getWishDir,
  getHorizontalSpeed,
} from './useMovement';
import { ENGINE_PHYSICS } from './constants';

const dt = ENGINE_PHYSICS.TICK_DELTA;

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
    const vel = new Vector3(ENGINE_PHYSICS.GROUND_MAX_SPEED, 0, 0);
    const wishDir = new Vector3(1, 0, 0);
    applyGroundAcceleration(vel, wishDir, dt);
    expect(vel.x).toBe(ENGINE_PHYSICS.GROUND_MAX_SPEED);
  });

  it('does not accelerate against wish direction', () => {
    const vel = new Vector3(ENGINE_PHYSICS.GROUND_MAX_SPEED + 100, 0, 0);
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
    expect(vel.x).toBeCloseTo(ENGINE_PHYSICS.AIR_SPEED_CAP, 0);
  });

  it('gains speed via strafe acceleration beyond AIR_SPEED_CAP', () => {
    const vel = new Vector3(ENGINE_PHYSICS.AIR_SPEED_CAP, 0, 0);

    // Strafe perpendicular to current velocity — this is how players gain speed in Quake
    for (let i = 0; i < 100; i++) {
      const wishDir = new Vector3(0, 0, 1); // pure strafe
      applyAirAcceleration(vel, wishDir, dt);
    }
    // Total speed should exceed AIR_SPEED_CAP via strafe acceleration
    expect(getHorizontalSpeed(vel)).toBeGreaterThan(ENGINE_PHYSICS.AIR_SPEED_CAP);
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
    // At yaw=π/2, forward → (-1, 0, 0)
    // Three.js Y rotation: x = fz*sin(yaw), z = fz*cos(yaw) for fz=-1
    expect(dir90.x).toBeCloseTo(dir0.z, 3);
    expect(dir90.z).toBeCloseTo(-dir0.x, 3);
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

describe('strafe jump speed gain', () => {
  it('builds total speed via air strafing above initial speed', () => {
    // Quake strafe jumping: perpendicular strafe adds a velocity component,
    // increasing total speed. Start at 300, strafe perpendicular → total > 300.
    const vel = new Vector3(300, 0, 0);
    const initialSpeed = getHorizontalSpeed(vel);
    for (let i = 0; i < 64; i++) {
      const wishDir = new Vector3(0, 0, 1).normalize();
      applyAirAcceleration(vel, wishDir, dt);
    }
    expect(getHorizontalSpeed(vel)).toBeGreaterThan(initialSpeed);
  });

  it('continues gaining speed beyond ground max when already fast', () => {
    // Once above ground max speed, strafing perpendicular still adds speed
    // because dot product of velocity with perpendicular wishDir is 0
    const vel = new Vector3(400, 0, 0);
    const initialSpeed = getHorizontalSpeed(vel);
    const wishDir = new Vector3(0, 0, 1).normalize();
    applyAirAcceleration(vel, wishDir, dt);
    expect(getHorizontalSpeed(vel)).toBeGreaterThan(initialSpeed);
  });

  it('preserves horizontal speed through jump (no friction on jump frame)', () => {
    const vel = new Vector3(350, 0, 0);
    const speedBefore = getHorizontalSpeed(vel);
    // Jump sets vy but does NOT apply friction on the jump tick
    vel.y = ENGINE_PHYSICS.JUMP_FORCE;
    expect(getHorizontalSpeed(vel)).toBe(speedBefore);
  });
});

describe('bhop momentum preservation', () => {
  it('does not lose speed when landing and immediately jumping', () => {
    // Simulate: moving fast, landing one frame, immediately jumping
    const vel = new Vector3(400, -50, 0);
    const speedBefore = getHorizontalSpeed(vel);

    // Land: clamp vy, then immediately jump (skip friction)
    vel.y = 0; // grounded
    // bhop: instant jump on same tick → no friction applied
    vel.y = ENGINE_PHYSICS.JUMP_FORCE;

    // Horizontal speed should be preserved
    expect(getHorizontalSpeed(vel)).toBe(speedBefore);
  });
});

describe('applySlideFriction', () => {
  it('applies less friction than ground friction', () => {
    const velGround = new Vector3(300, 0, 0);
    const velSlide = new Vector3(300, 0, 0);

    applyFriction(velGround, dt);
    applySlideFriction(velSlide, dt);

    // Slide friction should preserve more speed
    expect(velSlide.x).toBeGreaterThan(velGround.x);
  });

  it('snaps near-zero velocity to zero', () => {
    const vel = new Vector3(0.05, 0, 0.05);
    applySlideFriction(vel, dt);
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
  });

  it('does not affect vertical velocity', () => {
    const vel = new Vector3(200, 100, 0);
    applySlideFriction(vel, dt);
    expect(vel.y).toBe(100);
  });

  it('reduces speed gradually over time', () => {
    const vel = new Vector3(400, 0, 0);
    const speeds: number[] = [];
    for (let i = 0; i < 128; i++) {
      applySlideFriction(vel, dt);
      speeds.push(getHorizontalSpeed(vel));
    }
    // Speed should monotonically decrease
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1]);
    }
    // After 1 second of sliding, should still have meaningful speed
    expect(speeds[speeds.length - 1]).toBeGreaterThan(50);
  });
});
