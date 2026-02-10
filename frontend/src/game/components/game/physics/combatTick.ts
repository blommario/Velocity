import { PHYSICS, ADS_CONFIG, RECOIL_CONFIG } from './constants';
import { WEAPONS } from './types';
import type { TickContext } from './state';
import { _fireDir } from './scratch';
import { useCombatStore } from '@game/stores/combatStore';
import { tickScopeSway, resetScopeSwayState, type ScopeSwayConfig } from '@engine/physics/scopeSway';
import { tickRecoil } from '@engine/physics/recoil';

const HUD_UPDATE_HZ = 30;
const HUD_UPDATE_INTERVAL = 1000 / HUD_UPDATE_HZ;

const scopeSwayConfig: ScopeSwayConfig = {
  swayBase: PHYSICS.SCOPE_SWAY_BASE,
  swaySpeed: PHYSICS.SCOPE_SWAY_SPEED,
  mouseInfluence: PHYSICS.SCOPE_SWAY_MOUSE_MULT,
  breathHoldDuration: PHYSICS.SCOPE_BREATH_HOLD_DURATION,
  breathPenaltyMult: PHYSICS.SCOPE_BREATH_PENALTY_MULT,
  stableTime: PHYSICS.SCOPE_STABLE_TIME,
  driftTime: PHYSICS.SCOPE_DRIFT_TIME,
  forceUnscopeTime: PHYSICS.SCOPE_FORCE_UNSCOPE_TIME,
  driftMult: PHYSICS.SCOPE_DRIFT_MULT,
};

export function handleCombatState(ctx: TickContext, dx: number, dy: number): void {
  const { s, swayState: scopeSwayState, refs, input, velocity, dt } = ctx;
  const combat = useCombatStore.getState();
  const weapon = combat.activeWeapon;

  combat.tickCooldown(dt);

  _fireDir.set(
    -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
    Math.sin(refs.pitch.current),
    -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
  ).normalize();

  // ADS state machine
  const adsTarget = (input.altFire && ADS_CONFIG[weapon].canAds && combat.swapCooldown <= 0) ? 1 : 0;
  const prevAds = s.adsProgress;
  s.adsProgress += (adsTarget - s.adsProgress) * (1 - Math.exp(-PHYSICS.ADS_TRANSITION_SPEED * dt));
  if (Math.abs(s.adsProgress - adsTarget) < 0.005) s.adsProgress = adsTarget;
  if (Math.abs(s.adsProgress - prevAds) > 0.001) {
    useCombatStore.setState({ adsProgress: s.adsProgress });
  }
  s.wasAltFire = input.altFire;

  // Sniper scope sway
  const isSniperScoped = weapon === WEAPONS.SNIPER && s.adsProgress > 0.9;
  if (isSniperScoped) {
    const mouseMag = Math.sqrt(dx * dx + dy * dy);
    tickScopeSway(scopeSwayState, scopeSwayConfig, dt, input.crouch, mouseMag);
    if (scopeSwayState.forceUnscope) {
      s.adsProgress = 0;
      useCombatStore.setState({ adsProgress: 0 });
    }
    const now = performance.now();
    if (now - s.lastScopeSwayUpdate > HUD_UPDATE_INTERVAL) {
      s.lastScopeSwayUpdate = now;
      useCombatStore.setState({
        scopeSwayX: scopeSwayState.swayX,
        scopeSwayY: scopeSwayState.swayY,
        isHoldingBreath: scopeSwayState.isHoldingBreath,
        breathHoldTime: scopeSwayState.breathHoldTime,
        scopeTime: scopeSwayState.scopeTime,
      });
    }
  } else if (scopeSwayState.scopeTime > 0 || scopeSwayState.swayX !== 0 || scopeSwayState.swayY !== 0) {
    resetScopeSwayState(scopeSwayState);
    s.lastScopeSwayUpdate = 0;
    useCombatStore.setState({
      scopeSwayX: 0, scopeSwayY: 0,
      isHoldingBreath: false, breathHoldTime: 0, scopeTime: 0,
    });
  }

  // Weapon inspect state machine
  const hasMovementInput = input.forward || input.backward || input.left || input.right;
  const shouldCancelInspect = input.fire || input.altFire || combat.swapCooldown > 0
    || combat.fireCooldown > 0 || hasMovementInput;
  const wantsInspect = input.inspect && !shouldCancelInspect && s.adsProgress < 0.01;
  const inspectTarget = wantsInspect ? 1 : 0;
  const prevInspect = s.inspectProgress;
  s.inspectProgress += (inspectTarget - s.inspectProgress) * (1 - Math.exp(-PHYSICS.INSPECT_TRANSITION_SPEED * dt));
  if (Math.abs(s.inspectProgress - inspectTarget) < 0.005) s.inspectProgress = inspectTarget;
  if (Math.abs(s.inspectProgress - prevInspect) > 0.001) {
    const isInspecting = s.inspectProgress > 0.1;
    useCombatStore.setState({ inspectProgress: s.inspectProgress, isInspecting });
  }

  // Recoil recovery tick
  const recoilRecovery = tickRecoil(ctx.recoilState, RECOIL_CONFIG, dt);
  if (recoilRecovery.dpitch !== 0 || recoilRecovery.dyaw !== 0) {
    refs.pitch.current += recoilRecovery.dpitch;
    refs.yaw.current += recoilRecovery.dyaw;
  }

  // Knife lunge movement
  if (combat.knifeLungeTimer > 0) {
    const ld = combat.knifeLungeDir;
    velocity.x = ld[0] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.z = ld[2] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.y = Math.max(velocity.y, ld[1] * PHYSICS.KNIFE_LUNGE_SPEED * 0.3);
  }

  // Plasma beam — plasma surf
  if (weapon === WEAPONS.PLASMA && input.fire && combat.ammo.plasma.current > 0) {
    if (!combat.isPlasmaFiring) combat.startPlasma();
    combat.tickPlasma(dt);
    velocity.x -= _fireDir.x * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.y -= _fireDir.y * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.z -= _fireDir.z * PHYSICS.PLASMA_PUSHBACK * dt;
    if (refs.grounded.current && _fireDir.y < PHYSICS.PLASMA_GROUND_DIR_THRESHOLD && velocity.y < PHYSICS.PLASMA_JUMP_UPLIFT) {
      velocity.y = PHYSICS.PLASMA_JUMP_UPLIFT;
      refs.grounded.current = false;
    }
  } else if (combat.isPlasmaFiring) {
    combat.stopPlasma();
  }
}
