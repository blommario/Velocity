/**
 * Weapon recoil & spread simulation — camera kick, recovery, and dynamic spread bloom.
 *
 * Pure functions + mutable state struct. No store dependencies.
 * Call `applyRecoilKick` on weapon fire, `tickRecoil` each physics tick.
 */

/** Per-weapon recoil tuning. */
export interface RecoilPattern {
  /** Vertical pitch kick per shot (radians, positive = up) */
  pitchPerShot: number;
  /** Horizontal yaw kick per shot (radians, random ± range) */
  yawPerShot: number;
  /** Accumulation factor for sustained fire (1.0 = fully stacks) */
  accumulation: number;
  /** Base spread cone radius (radians) when standing still at hip */
  baseSpread: number;
}

/** Configuration for the recoil system. */
export interface RecoilConfig {
  /** Camera recoil recovery speed (radians/sec) */
  recoverySpeed: number;
  /** Time in seconds without firing before recoil starts recovering */
  recoveryDelay: number;
  /** Crosshair bloom decay speed (units/sec) */
  bloomDecaySpeed: number;
  /** ADS recoil multiplier (0-1) */
  adsRecoilMult: number;
  /** Prone recoil multiplier (0-1) */
  proneRecoilMult: number;
  /** Movement spread multiplier (grounded) */
  movingSpreadMult: number;
  /** Movement spread multiplier (airborne) */
  airSpreadMult: number;
  /** Crouch spread multiplier */
  crouchSpreadMult: number;
}

export interface RecoilState {
  /** Accumulated camera pitch offset from recoil (radians) */
  pitchOffset: number;
  /** Accumulated camera yaw offset from recoil (radians) */
  yawOffset: number;
  /** Time since last shot (seconds) — for recovery delay */
  timeSinceShot: number;
  /** Number of shots fired in current burst (resets after recovery delay) */
  burstCount: number;
  /** Current crosshair bloom (spread indicator, 0 = no bloom) */
  bloom: number;
}

export function createRecoilState(): RecoilState {
  return {
    pitchOffset: 0,
    yawOffset: 0,
    timeSinceShot: Infinity,
    burstCount: 0,
    bloom: 0,
  };
}

export function resetRecoilState(state: RecoilState): void {
  state.pitchOffset = 0;
  state.yawOffset = 0;
  state.timeSinceShot = Infinity;
  state.burstCount = 0;
  state.bloom = 0;
}

// Seeded random not imported — caller supplies random value
// to keep this module engine-pure.

/**
 * Apply a recoil kick from firing a weapon.
 * Mutates `state` in place. Returns the actual pitch/yaw offsets applied
 * so the caller can adjust camera angles.
 *
 * @param state      Mutable recoil state
 * @param pattern    Weapon-specific recoil pattern
 * @param adsFactor  0 = hip, 1 = fully ADS
 * @param proneFactor 0 = not prone, 1 = prone
 * @param adsRecoilMult  Config multiplier for ADS
 * @param proneRecoilMult Config multiplier for prone
 * @param randomX    Random value in [-1, 1] for horizontal variation
 */
export function applyRecoilKick(
  state: RecoilState,
  pattern: RecoilPattern,
  adsFactor: number,
  proneFactor: number,
  adsRecoilMult: number,
  proneRecoilMult: number,
  randomX: number,
): { dpitch: number; dyaw: number } {
  // Accumulation: each consecutive shot adds more recoil
  const accum = 1 + state.burstCount * pattern.accumulation;

  // Stance reduction
  const stanceMult = (1 - adsFactor * (1 - adsRecoilMult))
                   * (1 - proneFactor * (1 - proneRecoilMult));

  const dpitch = pattern.pitchPerShot * accum * stanceMult;
  const dyaw = pattern.yawPerShot * randomX * accum * stanceMult;

  state.pitchOffset += dpitch;
  state.yawOffset += dyaw;
  state.timeSinceShot = 0;
  state.burstCount++;

  // Bloom: each shot expands crosshair bloom
  state.bloom += pattern.baseSpread * 30; // bloom units (pixels-ish)

  return { dpitch, dyaw };
}

/**
 * Advance recoil recovery and bloom decay by one tick.
 * Mutates `state` in place. Returns the pitch/yaw delta consumed by recovery
 * so the caller can adjust camera angles back.
 *
 * @param state   Mutable recoil state
 * @param config  System-wide recoil config
 * @param dt      Delta time in seconds
 */
export function tickRecoil(
  state: RecoilState,
  config: RecoilConfig,
  dt: number,
): { dpitch: number; dyaw: number } {
  state.timeSinceShot += dt;

  let dpitch = 0;
  let dyaw = 0;

  // Reset burst counter after recovery delay
  if (state.timeSinceShot > config.recoveryDelay) {
    state.burstCount = 0;
  }

  // Recovery: exponential decay camera back to origin
  if (state.timeSinceShot > config.recoveryDelay) {
    const oldPitch = state.pitchOffset;
    const oldYaw = state.yawOffset;

    const decayFactor = Math.exp(-config.recoverySpeed * dt);
    state.pitchOffset *= decayFactor;
    state.yawOffset *= decayFactor;

    // Snap to zero to prevent micro-jitters
    if (Math.abs(state.pitchOffset) < 0.0001) state.pitchOffset = 0;
    if (Math.abs(state.yawOffset) < 0.0001) state.yawOffset = 0;

    dpitch = state.pitchOffset - oldPitch;
    dyaw = state.yawOffset - oldYaw;
  }

  // Bloom decay
  if (state.bloom > 0) {
    state.bloom = Math.max(0, state.bloom - config.bloomDecaySpeed * dt);
  }

  return { dpitch, dyaw };
}

/**
 * Compute effective spread multiplier based on movement state.
 *
 * @param isMoving     Whether player has horizontal movement input
 * @param isGrounded   Whether player is on the ground
 * @param isCrouching  Whether player is crouching
 * @param isProne      Whether player is prone
 * @param adsFactor    0 = hip, 1 = fully ADS
 * @param config       Recoil config with multipliers
 * @param proneSpreadMult Game-level prone spread multiplier
 */
export function getSpreadMultiplier(
  isMoving: boolean,
  isGrounded: boolean,
  isCrouching: boolean,
  isProne: boolean,
  adsFactor: number,
  config: RecoilConfig,
  proneSpreadMult: number,
): number {
  let mult = 1.0;

  // Movement penalty
  if (!isGrounded) {
    mult *= config.airSpreadMult;
  } else if (isMoving) {
    mult *= config.movingSpreadMult;
  }

  // Stance bonuses (stacking)
  if (isProne) {
    mult *= proneSpreadMult;
  } else if (isCrouching) {
    mult *= config.crouchSpreadMult;
  }

  // ADS tightens spread
  mult *= (1 - adsFactor * (1 - config.adsRecoilMult));

  return mult;
}
