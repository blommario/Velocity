/**
 * Scope sway simulation — generic scope unsteadiness, breath hold, and drift.
 *
 * Pure functions + mutable state struct. No store dependencies.
 * Call `tickScopeSway` each physics tick to advance the simulation.
 */

export interface ScopeSwayConfig {
  /** Base sway amplitude as fraction of screen (default 0.012) */
  swayBase: number;
  /** Base oscillation speed (default 1.4) */
  swaySpeed: number;
  /** Mouse movement amplification factor (default 0.08) */
  mouseInfluence: number;
  /** Max breath hold duration in seconds (default 2.0) */
  breathHoldDuration: number;
  /** Sway multiplier after breath expires (default 2.5) */
  breathPenaltyMult: number;
  /** Seconds of stable sway before drift begins (default 3.0) */
  stableTime: number;
  /** Seconds until drift becomes severe (default 6.0) */
  driftTime: number;
  /** Force unscope after this many seconds (default 6.0) */
  forceUnscopeTime: number;
  /** Sway multiplier at max drift (default 3.0) */
  driftMult: number;
}

export interface ScopeSwayState {
  swayX: number;
  swayY: number;
  scopeTime: number;
  breathHoldTime: number;
  isHoldingBreath: boolean;
  phase: number;
  /** Set to true by tickScopeSway when forceUnscopeTime is exceeded */
  forceUnscope: boolean;
}

export function createScopeSwayState(): ScopeSwayState {
  return {
    swayX: 0,
    swayY: 0,
    scopeTime: 0,
    breathHoldTime: 0,
    isHoldingBreath: false,
    phase: 0,
    forceUnscope: false,
  };
}

export function resetScopeSwayState(state: ScopeSwayState): void {
  state.swayX = 0;
  state.swayY = 0;
  state.scopeTime = 0;
  state.breathHoldTime = 0;
  state.isHoldingBreath = false;
  state.phase = 0;
  state.forceUnscope = false;
}

/**
 * Advance scope sway simulation by one tick.
 * Mutates `state` in place for zero-allocation hot-path usage.
 *
 * @param state    Mutable sway state
 * @param config   Scope sway tuning parameters
 * @param dt       Delta time in seconds
 * @param holdBreathInput  Whether the breath-hold key is pressed
 * @param mouseMagnitude   Raw mouse delta magnitude (pixels) this tick
 */
export function tickScopeSway(
  state: ScopeSwayState,
  config: ScopeSwayConfig,
  dt: number,
  holdBreathInput: boolean,
  mouseMagnitude: number,
): void {
  state.scopeTime += dt;
  state.forceUnscope = false;

  // --- Breath hold ---
  if (holdBreathInput && !state.isHoldingBreath && state.breathHoldTime < config.breathHoldDuration) {
    state.isHoldingBreath = true;
  }
  if (state.isHoldingBreath) {
    if (!holdBreathInput || state.breathHoldTime >= config.breathHoldDuration) {
      state.isHoldingBreath = false;
    } else {
      state.breathHoldTime += dt;
    }
  }

  // --- Sway multiplier ---
  let swayMult = 1.0;

  // Unsteadiness ramp: stable → drift
  if (state.scopeTime > config.stableTime) {
    const driftProgress = Math.min(1,
      (state.scopeTime - config.stableTime) / (config.driftTime - config.stableTime),
    );
    swayMult += (config.driftMult - 1) * driftProgress;
  }

  // Breath hold: near-zero sway while holding, penalty after release
  if (state.isHoldingBreath) {
    swayMult *= 0.05;
  } else if (state.breathHoldTime > 0) {
    swayMult *= config.breathPenaltyMult;
  }

  // Decay breathHoldTime when not holding (1:1 recovery ratio)
  if (!state.isHoldingBreath && state.breathHoldTime > 0) {
    state.breathHoldTime = Math.max(0, state.breathHoldTime - dt);
  }

  // --- Oscillation (figure-8 pattern) ---
  state.phase += config.swaySpeed * dt;
  const baseSwayX = Math.sin(state.phase * 1.0) * 0.6 + Math.sin(state.phase * 2.3) * 0.4;
  const baseSwayY = Math.sin(state.phase * 0.7) * 0.5 + Math.cos(state.phase * 1.9) * 0.5;

  // Mouse amplification
  const mouseInfl = 1 + mouseMagnitude * config.mouseInfluence;

  const amplitude = config.swayBase * swayMult * mouseInfl;
  const lerpFactor = 1 - Math.exp(-8 * dt);
  state.swayX += (baseSwayX * amplitude - state.swayX) * lerpFactor;
  state.swayY += (baseSwayY * amplitude - state.swayY) * lerpFactor;

  // Force unscope
  if (state.scopeTime >= config.forceUnscopeTime) {
    state.forceUnscope = true;
  }
}
