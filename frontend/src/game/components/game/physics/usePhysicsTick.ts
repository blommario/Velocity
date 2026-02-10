import { type MutableRefObject } from 'react';
import { Vector3, type Camera } from 'three';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
import { Ray, QueryFilterFlags } from '@dimforge/rapier3d-compat';
import { PHYSICS, ADS_CONFIG } from './constants';
import type { InputState } from './types';
import {
  applyFriction,
  applySlideFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  applySlopeGravity,
  getWishDir,
  getHorizontalSpeed,
} from '@engine/physics/useMovement';
import { getGroundNormal, getSlopeAngleDeg } from '@engine/physics/slopeDetection';
import {
  applyGrappleSwing,
  applyExplosionKnockback,
  applyBoostPad,
  applyLaunchPad,
  applySpeedGate,
  type WallRunState,
  updateWallRun,
  wallJump,
} from '@engine/physics/useAdvancedMovement';
import { useGameStore, RUN_STATES, type Stance } from '@game/stores/gameStore';
import { useSettingsStore } from '@game/stores/settingsStore';
import { useCombatStore } from '@game/stores/combatStore';
import { useReplayStore } from '@game/stores/replayStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';
import { useExplosionStore } from '@engine/effects/ExplosionEffect';
import { spawnDecal } from '@engine/effects/DecalPool';
import { nextRandom } from '@engine/physics/seededRandom';
import { tickScopeSway, createScopeSwayState, resetScopeSwayState, type ScopeSwayConfig } from '@engine/physics/scopeSway';
import { devLog } from '@engine/stores/devLogStore';
import {
  spawnProjectile, deactivateAt, updatePositions,
  getPool, getPoolSize, activeCount,
} from './projectilePool';
import { pushHitMarker } from '../../hud/HitMarker';
import { spawnWallSparks } from '../effects/wallSparks';

// ── Constants ──

const MAX_PITCH = Math.PI / 2 - 0.01;
const HUD_UPDATE_HZ = 30;
const HUD_UPDATE_INTERVAL = 1000 / HUD_UPDATE_HZ;
const DEV_LOG_INTERVAL = 2000;

const WALL_RUN_TILT = 0.15;
const TILT_LERP_SPEED = 10;
const LANDING_DIP_AMOUNT = 0.12;
const LANDING_DIP_DECAY = 8;
const LANDING_DIP_MIN_FALL = 150;

const RESPAWN_GRACE_TICKS = 16;
const FOOTSTEP_INTERVAL_BASE = 0.4;
const FOOTSTEP_INTERVAL_MIN = 0.2;

// ── Pre-allocated scratch objects (stateless, zero GC) ──

const _desiredTranslation = new Vector3();
const _correctedMovement = new Vector3();
const _newPos = new Vector3();
const _playerPos = new Vector3();
const _fireDir = new Vector3();
const _reusableRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
const _mantleRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
const _hitPos: [number, number, number] = [0, 0, 0];
const _gPos: [number, number, number] = [0, 0, 0];

// ── Scope sway config (constant, shared across instances) ──

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

// ══════════════════════════════════════════════════════════
// A: Physics tick state — single struct replaces ~30 let vars
// ══════════════════════════════════════════════════════════

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
  slideTimer: number;            // time spent in current slide
  proneTransition: number;       // 0 = not transitioning, >0 = transitioning in/out
  proneTransitionTarget: boolean; // true = going prone, false = standing up
  lastCrouchPress: number;       // timestamp of last crouch press (double-tap detection)
  slidePitchOffset: number;      // current camera pitch tilt during slide
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
  };
}

// ── Active instance registry (set by PlayerController on mount) ──

let _activeState: PhysicsTickState | null = null;
let _activeSwayState: ReturnType<typeof createScopeSwayState> | null = null;

/** Called by PlayerController to register its owned state instances. */
export function registerPhysicsTickState(
  state: PhysicsTickState,
  swayState: ReturnType<typeof createScopeSwayState>,
): void {
  _activeState = state;
  _activeSwayState = swayState;
}

/** Reset active physics tick state. Call on map load / game restart. */
export function resetPhysicsTickState(): void {
  if (_activeState) Object.assign(_activeState, createPhysicsTickState());
  if (_activeSwayState) resetScopeSwayState(_activeSwayState);
}

// ══════════════════════════════════════════════════════════
// B: Tick context — shared parameter object for sub-functions
// ══════════════════════════════════════════════════════════

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

interface TickContext {
  s: PhysicsTickState;
  swayState: ReturnType<typeof createScopeSwayState>;
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

// ══════════════════════════════════════════════════════════
// Sub-functions (B: composition)
// ══════════════════════════════════════════════════════════

function handleRespawn(
  ctx: TickContext,
  consumeMouseDelta: () => { dx: number; dy: number },
): boolean {
  const { s, refs, rb, velocity, camera } = ctx;
  const store = useGameStore.getState();
  const pos = rb.translation();

  if (pos.y < -50 || !Number.isFinite(pos.y)) {
    store.triggerDeathFlash();
    store.requestRespawn();
  }

  const respawn = store.consumeRespawn();
  if (respawn) {
    store.triggerRespawnFade();
    rb.setNextKinematicTranslation({ x: respawn.pos[0], y: respawn.pos[1], z: respawn.pos[2] });
    _newPos.set(respawn.pos[0], respawn.pos[1], respawn.pos[2]);
    velocity.set(0, 0, 0);
    refs.yaw.current = respawn.yaw;
    refs.pitch.current = 0;
    refs.grounded.current = false;
    refs.isCrouching.current = false;
    refs.isSliding.current = false;
    refs.isProne.current = false;
    refs.isJumping.current = false;
    refs.coyoteTime.current = 0;
    refs.jumpHoldTime.current = 0;
    s.wallRunState.isWallRunning = false;
    s.wallRunState.wallRunCooldown = false;
    s.mantleTimer = 0;
    s.mantleCooldown = 0;
    s.proneTransition = 0;
    s.slideTimer = 0;
    s.slidePitchOffset = 0;
    s.respawnGraceTicks = RESPAWN_GRACE_TICKS;
    ctx.collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
    camera.position.set(respawn.pos[0], respawn.pos[1] + PHYSICS.PLAYER_EYE_OFFSET, respawn.pos[2]);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = respawn.yaw;
    camera.rotation.x = 0;
    useCombatStore.getState().stopGrapple();
    devLog.info('Physics', `Respawn → [${respawn.pos.map(v => v.toFixed(1)).join(', ')}] yaw=${(respawn.yaw * 180 / Math.PI).toFixed(0)}°`);
    return true;
  }

  if (s.respawnGraceTicks > 0) {
    s.respawnGraceTicks--;
    const { dx: gDx, dy: gDy } = consumeMouseDelta();
    refs.yaw.current -= gDx * ctx.sensitivity;
    refs.pitch.current -= gDy * ctx.sensitivity;
    refs.pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, refs.pitch.current));
    camera.position.set(pos.x, pos.y + PHYSICS.PLAYER_EYE_OFFSET, pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = refs.yaw.current;
    camera.rotation.x = refs.pitch.current;
    return true;
  }

  return false;
}

function handleMouseLook(ctx: TickContext, dx: number, dy: number): void {
  const { s, refs } = ctx;
  const effectiveSens = ctx.sensitivity * (1 - s.adsProgress * (1 - ctx.adsSensitivityMult));
  refs.yaw.current -= dx * effectiveSens;
  refs.pitch.current -= dy * effectiveSens;
  refs.pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, refs.pitch.current));
}

function handleZoneEvents(ctx: TickContext): void {
  const { refs, velocity } = ctx;
  const combat = useCombatStore.getState();
  const zoneEvents = combat.drainZoneEvents();
  for (const evt of zoneEvents) {
    switch (evt.type) {
      case 'boostPad':
        applyBoostPad(velocity, evt.direction, evt.speed);
        audioManager.play(SOUNDS.BOOST_PAD);
        devLog.info('Zone', `Boost pad → speed=${evt.speed} dir=[${evt.direction.join(',')}]`);
        break;
      case 'launchPad':
        applyLaunchPad(velocity, evt.direction, evt.speed);
        refs.grounded.current = false;
        audioManager.play(SOUNDS.LAUNCH_PAD);
        devLog.info('Zone', `Launch pad → speed=${evt.speed}`);
        break;
      case 'speedGate':
        applySpeedGate(velocity, evt.multiplier, evt.minSpeed);
        audioManager.play(SOUNDS.SPEED_GATE);
        devLog.info('Zone', `Speed gate → ${evt.multiplier}x (min ${evt.minSpeed})`);
        break;
      case 'ammoPickup':
        combat.pickupAmmo(evt.weaponType, evt.amount);
        audioManager.play(SOUNDS.AMMO_PICKUP);
        devLog.info('Zone', `Picked up ${evt.amount} ${evt.weaponType} ammo`);
        break;
    }
  }
}

function handleWeaponSwitch(ctx: TickContext): void {
  const { input } = ctx;
  const combat = useCombatStore.getState();
  if (input.weaponSlot > 0) {
    combat.switchWeaponBySlot(input.weaponSlot);
    input.weaponSlot = 0;
  }
  if (input.scrollDelta !== 0) {
    combat.scrollWeapon(input.scrollDelta > 0 ? 1 : -1);
    input.scrollDelta = 0;
  }
}

function handleGrapple(ctx: TickContext): void {
  const { s, refs, velocity, rb, rapierWorld, dt } = ctx;
  const combat = useCombatStore.getState();
  const grapplePressed = ctx.input.grapple;
  const grappleJustPressed = grapplePressed && !s.wasGrapplePressed;
  s.wasGrapplePressed = grapplePressed;

  const pos = rb.translation();
  _playerPos.set(pos.x, pos.y, pos.z);

  if (combat.isGrappling) {
    if (!grapplePressed && combat.grappleTarget) {
      const speed = velocity.length();
      velocity.multiplyScalar(PHYSICS.GRAPPLE_RELEASE_BOOST);
      if (velocity.length() < speed) {
        velocity.normalize().multiplyScalar(speed * PHYSICS.GRAPPLE_RELEASE_BOOST);
      }
      combat.stopGrapple();
      audioManager.play(SOUNDS.GRAPPLE_RELEASE);
    } else if (combat.grappleTarget) {
      applyGrappleSwing(velocity, _playerPos, combat.grappleTarget, combat.grappleLength, dt);
    }
  } else if (grappleJustPressed) {
    _fireDir.set(
      -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
      Math.sin(refs.pitch.current),
      -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
    ).normalize();

    const grapplePoints = combat.registeredGrapplePoints;
    let bestDist = PHYSICS.GRAPPLE_MAX_DISTANCE;
    let bestPoint: [number, number, number] | null = null;

    for (const gp of grapplePoints) {
      const gpDx = gp[0] - _playerPos.x;
      const gpDy = gp[1] - _playerPos.y;
      const gpDz = gp[2] - _playerPos.z;
      const dist = Math.sqrt(gpDx * gpDx + gpDy * gpDy + gpDz * gpDz);
      if (dist > PHYSICS.GRAPPLE_MAX_DISTANCE || dist < 1) continue;
      const dot = (gpDx / dist) * _fireDir.x + (gpDy / dist) * _fireDir.y + (gpDz / dist) * _fireDir.z;
      if (dot < 0.3) continue;
      if (dist < bestDist) { bestDist = dist; bestPoint = gp; }
    }

    if (!bestPoint) {
      _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y; _reusableRay.origin.z = _playerPos.z;
      _reusableRay.dir.x = _fireDir.x; _reusableRay.dir.y = _fireDir.y; _reusableRay.dir.z = _fireDir.z;
      const grappleHit = rapierWorld.castRay(_reusableRay, PHYSICS.GRAPPLE_MAX_DISTANCE, true, undefined, undefined, undefined, rb);
      if (grappleHit) {
        bestPoint = [
          _playerPos.x + _fireDir.x * grappleHit.timeOfImpact,
          _playerPos.y + _fireDir.y * grappleHit.timeOfImpact,
          _playerPos.z + _fireDir.z * grappleHit.timeOfImpact,
        ];
        bestDist = grappleHit.timeOfImpact;
      }
    }

    if (bestPoint) {
      combat.startGrapple(bestPoint, bestDist);
      audioManager.play(SOUNDS.GRAPPLE_ATTACH);
      devLog.info('Combat', `Grapple attached → dist=${bestDist.toFixed(1)}`);
    }
  }
}

function handleCombatState(ctx: TickContext, dx: number, dy: number): void {
  const { s, swayState: scopeSwayState, refs, input, velocity, dt } = ctx;
  const combat = useCombatStore.getState();
  const weapon = combat.activeWeapon;

  // Cooldowns
  combat.tickCooldown(dt);

  // Compute fire direction
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
  const isSniperScoped = weapon === 'sniper' && s.adsProgress > 0.9;
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

  // Knife lunge movement
  if (combat.knifeLungeTimer > 0) {
    const ld = combat.knifeLungeDir;
    velocity.x = ld[0] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.z = ld[2] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.y = Math.max(velocity.y, ld[1] * PHYSICS.KNIFE_LUNGE_SPEED * 0.3);
  }

  // Plasma beam — plasma surf
  if (weapon === 'plasma' && input.fire && combat.ammo.plasma.current > 0) {
    if (!combat.isPlasmaFiring) combat.startPlasma();
    combat.tickPlasma(dt);
    velocity.x -= _fireDir.x * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.y -= _fireDir.y * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.z -= _fireDir.z * PHYSICS.PLASMA_PUSHBACK * dt;
    if (refs.grounded.current && _fireDir.y < -0.3 && velocity.y < 60) {
      velocity.y = 60;
      refs.grounded.current = false;
    }
  } else if (combat.isPlasmaFiring) {
    combat.stopPlasma();
  }
}

function handleWeaponFire(ctx: TickContext): void {
  const { refs, velocity, rapierWorld, rb } = ctx;
  const combat = useCombatStore.getState();
  const weapon = combat.activeWeapon;
  const canFireNow = combat.fireCooldown <= 0 && combat.swapCooldown <= 0;
  const eyeOff = refs.isProne.current ? PHYSICS.PLAYER_EYE_OFFSET_PRONE
    : refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;

  if (!ctx.input.fire || !canFireNow) return;

  switch (weapon) {
    case 'rocket': {
      if (combat.ammo.rocket.current > 0) {
        const sx = _playerPos.x + _fireDir.x;
        const sy = _playerPos.y + eyeOff + _fireDir.y;
        const sz = _playerPos.z + _fireDir.z;
        spawnProjectile('rocket', sx, sy, sz,
          _fireDir.x * PHYSICS.ROCKET_SPEED, _fireDir.y * PHYSICS.ROCKET_SPEED, _fireDir.z * PHYSICS.ROCKET_SPEED);
        const newAmmo = combat.ammo.rocket.current - 1;
        useCombatStore.setState((s) => ({
          fireCooldown: PHYSICS.ROCKET_FIRE_COOLDOWN,
          ammo: { ...s.ammo, rocket: { ...s.ammo.rocket, current: newAmmo } },
        }));
        audioManager.play(SOUNDS.ROCKET_FIRE);
        devLog.info('Combat', `Rocket fired → ammo=${newAmmo}`);
      }
      break;
    }
    case 'grenade': {
      if (combat.ammo.grenade.current > 0) {
        const sx = _playerPos.x + _fireDir.x * 0.8;
        const sy = _playerPos.y + eyeOff + _fireDir.y * 0.8;
        const sz = _playerPos.z + _fireDir.z * 0.8;
        spawnProjectile('grenade', sx, sy, sz,
          _fireDir.x * PHYSICS.GRENADE_SPEED, _fireDir.y * PHYSICS.GRENADE_SPEED + 100, _fireDir.z * PHYSICS.GRENADE_SPEED);
        const newAmmo = combat.ammo.grenade.current - 1;
        useCombatStore.setState((s) => ({
          fireCooldown: PHYSICS.GRENADE_FIRE_COOLDOWN,
          ammo: { ...s.ammo, grenade: { ...s.ammo.grenade, current: newAmmo } },
        }));
        audioManager.play(SOUNDS.GRENADE_THROW);
        devLog.info('Combat', `Grenade thrown → ammo=${newAmmo}`);
      }
      break;
    }
    case 'sniper': {
      if (combat.fireHitscan('sniper')) {
        _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
        _reusableRay.dir.x = _fireDir.x; _reusableRay.dir.y = _fireDir.y; _reusableRay.dir.z = _fireDir.z;
        // D: castRay first (cheaper), castRayAndGetNormal only on hit
        const sniperHit = rapierWorld.castRay(_reusableRay, PHYSICS.SNIPER_RANGE, true, undefined, undefined, undefined, rb);
        if (sniperHit) {
          const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, sniperHit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
          if (hitWithNormal) {
            const shx = _playerPos.x + _fireDir.x * hitWithNormal.timeOfImpact;
            const shy = (_playerPos.y + eyeOff) + _fireDir.y * hitWithNormal.timeOfImpact;
            const shz = _playerPos.z + _fireDir.z * hitWithNormal.timeOfImpact;
            spawnWallSparks(shx, shy, shz, hitWithNormal.normal.x, hitWithNormal.normal.y, hitWithNormal.normal.z, 'heavy');
          }
          pushHitMarker();
        }
        velocity.x -= _fireDir.x * PHYSICS.SNIPER_KNOCKBACK;
        velocity.y -= _fireDir.y * PHYSICS.SNIPER_KNOCKBACK;
        velocity.z -= _fireDir.z * PHYSICS.SNIPER_KNOCKBACK;
        audioManager.play(SOUNDS.ROCKET_FIRE);
        devLog.info('Combat', `Sniper fired → ammo=${combat.ammo.sniper.current}`);
      }
      break;
    }
    case 'assault': {
      if (combat.fireHitscan('assault')) {
        const spreadX = (nextRandom() - 0.5) * PHYSICS.ASSAULT_SPREAD * 2;
        const spreadY = (nextRandom() - 0.5) * PHYSICS.ASSAULT_SPREAD * 2;
        const aimX = _fireDir.x + spreadX;
        const aimY = _fireDir.y + spreadY;
        const aimZ = _fireDir.z;
        const aimLen = Math.sqrt(aimX * aimX + aimY * aimY + aimZ * aimZ);
        _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
        _reusableRay.dir.x = aimX / aimLen; _reusableRay.dir.y = aimY / aimLen; _reusableRay.dir.z = aimZ / aimLen;
        // D: castRay first, castRayAndGetNormal only on hit
        const arHit = rapierWorld.castRay(_reusableRay, PHYSICS.ASSAULT_RANGE, true, undefined, undefined, undefined, rb);
        if (arHit) {
          const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, arHit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
          if (hitWithNormal) {
            const hx = _reusableRay.origin.x + _reusableRay.dir.x * hitWithNormal.timeOfImpact;
            const hy = _reusableRay.origin.y + _reusableRay.dir.y * hitWithNormal.timeOfImpact;
            const hz = _reusableRay.origin.z + _reusableRay.dir.z * hitWithNormal.timeOfImpact;
            spawnWallSparks(hx, hy, hz, hitWithNormal.normal.x, hitWithNormal.normal.y, hitWithNormal.normal.z, 'light');
          }
          pushHitMarker();
        }
        velocity.x -= _fireDir.x * PHYSICS.ASSAULT_KNOCKBACK * ctx.dt;
        velocity.z -= _fireDir.z * PHYSICS.ASSAULT_KNOCKBACK * ctx.dt;
        audioManager.play(SOUNDS.LAND_SOFT, 0.05);
      }
      break;
    }
    case 'shotgun': {
      if (combat.fireHitscan('shotgun')) {
        const physicalPellets = Math.min(PHYSICS.SHOTGUN_PELLETS, 4);
        for (let i = 0; i < physicalPellets; i++) {
          const sx = (nextRandom() - 0.5) * PHYSICS.SHOTGUN_SPREAD * 2;
          const sy = (nextRandom() - 0.5) * PHYSICS.SHOTGUN_SPREAD * 2;
          const px = _fireDir.x + sx;
          const py = _fireDir.y + sy;
          const pz = _fireDir.z;
          const pl = Math.sqrt(px * px + py * py + pz * pz);
          _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
          _reusableRay.dir.x = px / pl; _reusableRay.dir.y = py / pl; _reusableRay.dir.z = pz / pl;
          // D: castRay first, castRayAndGetNormal only on hit
          const hit = rapierWorld.castRay(_reusableRay, PHYSICS.SHOTGUN_RANGE, true, undefined, undefined, undefined, rb);
          if (hit) {
            const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, hit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
            if (hitWithNormal) {
              const hx = _reusableRay.origin.x + _reusableRay.dir.x * hitWithNormal.timeOfImpact;
              const hy = _reusableRay.origin.y + _reusableRay.dir.y * hitWithNormal.timeOfImpact;
              const hz = _reusableRay.origin.z + _reusableRay.dir.z * hitWithNormal.timeOfImpact;
              spawnWallSparks(hx, hy, hz, hitWithNormal.normal.x, hitWithNormal.normal.y, hitWithNormal.normal.z, 'medium');
            }
          }
        }
        for (let i = physicalPellets; i < PHYSICS.SHOTGUN_PELLETS; i++) {
          nextRandom(); nextRandom();
        }
        pushHitMarker();
        velocity.x -= _fireDir.x * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
        velocity.y -= _fireDir.y * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
        velocity.z -= _fireDir.z * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
        if (refs.grounded.current && velocity.y < PHYSICS.SHOTGUN_JUMP_UPLIFT) {
          velocity.y = PHYSICS.SHOTGUN_JUMP_UPLIFT;
          refs.grounded.current = false;
        }
        audioManager.play(SOUNDS.ROCKET_EXPLODE);
        devLog.info('Combat', `Shotgun fired → ammo=${combat.ammo.shotgun.current}`);
      }
      break;
    }
    case 'knife': {
      if (combat.fireKnife([_fireDir.x, _fireDir.y, _fireDir.z])) {
        audioManager.play(SOUNDS.GRAPPLE_ATTACH, 0.15);
        devLog.info('Combat', 'Knife lunge');
      }
      break;
    }
    case 'plasma':
      break; // Handled in handleCombatState
  }
}

function handleProjectiles(ctx: TickContext): void {
  const { velocity, rapierWorld, rb, dt } = ctx;
  const combat = useCombatStore.getState();
  const store = useGameStore.getState();
  const now = performance.now();
  const pool = getPool();
  const poolSize = getPoolSize();

  for (let i = 0; i < poolSize; i++) {
    const p = pool[i];
    if (!p.active) continue;

    const age = (now - p.spawnTime) / 1000;
    if (p.posY < -60 || age > 8) {
      deactivateAt(i);
      continue;
    }

    if (p.type === 'rocket') {
      const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY + p.velZ * p.velZ);
      if (speed < 0.01) { deactivateAt(i); continue; }

      const dirX = p.velX / speed;
      const dirY = p.velY / speed;
      const dirZ = p.velZ / speed;
      const travelDist = speed * dt;

      _reusableRay.origin.x = p.posX; _reusableRay.origin.y = p.posY; _reusableRay.origin.z = p.posZ;
      _reusableRay.dir.x = dirX; _reusableRay.dir.y = dirY; _reusableRay.dir.z = dirZ;

      // D: castRay first (miss = no normal computation), castRayAndGetNormal on hit
      const hit = rapierWorld.castRay(_reusableRay, travelDist + PHYSICS.ROCKET_RADIUS + 0.3, true, undefined, undefined, undefined, rb);

      if (hit) {
        _hitPos[0] = p.posX + dirX * hit.timeOfImpact;
        _hitPos[1] = p.posY + dirY * hit.timeOfImpact;
        _hitPos[2] = p.posZ + dirZ * hit.timeOfImpact;
        const damage = applyExplosionKnockback(
          velocity, _playerPos, _hitPos,
          PHYSICS.ROCKET_EXPLOSION_RADIUS, PHYSICS.ROCKET_KNOCKBACK_FORCE, PHYSICS.ROCKET_DAMAGE * PHYSICS.ROCKET_SELF_DAMAGE_MULT,
          ctx.refs.grounded.current,
        );
        if (damage > 0) {
          ctx.refs.grounded.current = false;
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.ROCKET_DAMAGE, 1) * 0.7);
        }
        audioManager.play(SOUNDS.ROCKET_EXPLODE);
        useExplosionStore.getState().spawnExplosion(_hitPos, '#ff6600', 8.0);
        // Get normal for decal (only on confirmed hit)
        const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, hit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
        const nx = hitWithNormal?.normal.x ?? 0;
        const ny = hitWithNormal?.normal.y ?? 1;
        const nz = hitWithNormal?.normal.z ?? 0;
        spawnDecal(_hitPos[0], _hitPos[1], _hitPos[2], nx, ny, nz, 2.0, 0.08, 0.05, 0.03);
        deactivateAt(i);
        devLog.info('Combat', `Rocket exploded at [${_hitPos[0].toFixed(1)}, ${_hitPos[1].toFixed(1)}, ${_hitPos[2].toFixed(1)}] dmg=${damage.toFixed(0)}`);
      }
    } else if (p.type === 'grenade') {
      if (age >= PHYSICS.GRENADE_FUSE_TIME) {
        _gPos[0] = p.posX; _gPos[1] = p.posY; _gPos[2] = p.posZ;
        const damage = applyExplosionKnockback(
          velocity, _playerPos, _gPos,
          PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, PHYSICS.GRENADE_DAMAGE * PHYSICS.ROCKET_SELF_DAMAGE_MULT,
          ctx.refs.grounded.current,
        );
        if (damage > 0) {
          ctx.refs.grounded.current = false;
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
        }
        audioManager.play(SOUNDS.GRENADE_EXPLODE);
        useExplosionStore.getState().spawnExplosion(_gPos, '#22c55e', 3.5);
        spawnDecal(_gPos[0], _gPos[1], _gPos[2], 0, 1, 0, 1.5, 0.05, 0.12, 0.04);
        deactivateAt(i);
        continue;
      }

      const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY + p.velZ * p.velZ);
      if (speed < 0.01) continue;

      const dirX = p.velX / speed;
      const dirY = p.velY / speed;
      const dirZ = p.velZ / speed;
      const travelDist = speed * dt;

      _reusableRay.origin.x = p.posX; _reusableRay.origin.y = p.posY; _reusableRay.origin.z = p.posZ;
      _reusableRay.dir.x = dirX; _reusableRay.dir.y = dirY; _reusableRay.dir.z = dirZ;

      // D: castRay first, castRayAndGetNormal only on hit (need normal for bounce)
      const hit = rapierWorld.castRay(_reusableRay, travelDist + PHYSICS.GRENADE_RADIUS + 0.3, true, undefined, undefined, undefined, rb);

      if (hit) {
        const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, hit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
        if (p.bounces >= 1) {
          _gPos[0] = p.posX; _gPos[1] = p.posY; _gPos[2] = p.posZ;
          const damage = applyExplosionKnockback(
            velocity, _playerPos, _gPos,
            PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, PHYSICS.GRENADE_DAMAGE * PHYSICS.ROCKET_SELF_DAMAGE_MULT,
            ctx.refs.grounded.current,
          );
          if (damage > 0) {
            ctx.refs.grounded.current = false;
            combat.takeDamage(damage);
            store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
          }
          audioManager.play(SOUNDS.GRENADE_EXPLODE);
          useExplosionStore.getState().spawnExplosion(_gPos, '#22c55e', 3.5);
          const gnx = hitWithNormal?.normal.x ?? 0;
          const gny = hitWithNormal?.normal.y ?? 1;
          const gnz = hitWithNormal?.normal.z ?? 0;
          spawnDecal(_gPos[0], _gPos[1], _gPos[2], gnx, gny, gnz, 1.5, 0.05, 0.12, 0.04);
          deactivateAt(i);
        } else if (hitWithNormal) {
          const normal = hitWithNormal.normal;
          const dot = p.velX * normal.x + p.velY * normal.y + p.velZ * normal.z;
          const damp = PHYSICS.GRENADE_BOUNCE_DAMPING;
          p.velX = (p.velX - 2 * dot * normal.x) * damp;
          p.velY = (p.velY - 2 * dot * normal.y) * damp;
          p.velZ = (p.velZ - 2 * dot * normal.z) * damp;
          p.bounces++;
        }
      }
    }
  }

  updatePositions(dt, PHYSICS.GRAVITY);
  combat.regenTick(dt);
}

function handleMovement(ctx: TickContext, wishDir: Vector3, hasInput: boolean): number {
  const { s, refs, velocity, dt, speedMult, gravMult, input } = ctx;
  const combat = useCombatStore.getState();
  const store = useGameStore.getState();

  // ── Stance state machine: Stand ↔ Crouch ↔ Prone, with sliding ──
  const wantsCrouch = input.crouch;
  const wantsProne = input.prone;
  const hSpeed = getHorizontalSpeed(velocity);

  // Double-tap crouch → prone detection (300ms window)
  const now_stance = ctx.now;
  const doubleTapProne = wantsCrouch && !refs.isCrouching.current && !refs.isProne.current
    && (now_stance - s.lastCrouchPress < 300);
  if (wantsCrouch && !refs.isCrouching.current && !refs.isProne.current && s.lastCrouchPress === 0) {
    s.lastCrouchPress = now_stance;
  }
  if (!wantsCrouch) {
    // Reset double-tap window after release
    if (s.lastCrouchPress > 0 && now_stance - s.lastCrouchPress > 300) {
      s.lastCrouchPress = 0;
    }
  }

  // Prone transition timer
  if (s.proneTransition > 0) {
    s.proneTransition -= dt;
    if (s.proneTransition <= 0) {
      s.proneTransition = 0;
      if (s.proneTransitionTarget) {
        refs.isProne.current = true;
        refs.isCrouching.current = false;
        refs.isSliding.current = false;
      } else {
        refs.isProne.current = false;
        refs.isCrouching.current = true; // prone→crouch first
      }
    }
  }

  // Prone entry: Z key or double-tap crouch (only grounded, not sliding)
  if ((wantsProne || doubleTapProne) && refs.grounded.current
      && !refs.isProne.current && s.proneTransition <= 0 && !refs.isSliding.current) {
    s.proneTransition = PHYSICS.PRONE_TRANSITION_TIME;
    s.proneTransitionTarget = true;
    refs.isCrouching.current = true; // go through crouch first
    refs.isSliding.current = false;
    s.lastCrouchPress = 0;
    audioManager.play(SOUNDS.LAND_SOFT, 0.08);
  }

  // Prone exit: stand/crouch while prone
  if (refs.isProne.current && !wantsProne && !wantsCrouch && s.proneTransition <= 0) {
    s.proneTransition = PHYSICS.PRONE_STAND_UP_TIME;
    s.proneTransitionTarget = false;
  }

  // Regular crouch/slide logic (only when not prone or transitioning to prone)
  if (!refs.isProne.current && s.proneTransition <= 0) {
    if (refs.grounded.current && wantsCrouch) {
      if (!refs.isCrouching.current && hSpeed >= PHYSICS.CROUCH_SLIDE_MIN_SPEED) {
        refs.isSliding.current = true;
        s.slideTimer = 0;
        const boost = PHYSICS.CROUCH_SLIDE_BOOST;
        if (hSpeed > 0) {
          velocity.x += (velocity.x / hSpeed) * boost;
          velocity.z += (velocity.z / hSpeed) * boost;
        }
        audioManager.play(SOUNDS.SLIDE, 0.15);
      }
      refs.isCrouching.current = true;
      // Slide duration cap: ramp up friction after CROUCH_SLIDE_DURATION
      if (refs.isSliding.current) {
        s.slideTimer += dt;
        if (hSpeed < PHYSICS.CROUCH_SLIDE_MIN_SPEED * 0.5 || s.slideTimer > PHYSICS.CROUCH_SLIDE_DURATION * 1.5) {
          refs.isSliding.current = false;
          s.slideTimer = 0;
        }
      }
    } else if (!refs.grounded.current) {
      // Crouch-jump: hold crouch in air → keep small capsule
      refs.isCrouching.current = wantsCrouch;
      refs.isSliding.current = false;
      s.slideTimer = 0;
    } else {
      refs.isCrouching.current = false;
      refs.isSliding.current = false;
      s.slideTimer = 0;
    }
  }

  // Capsule height: prone < crouch < standing
  let targetHeight: number;
  if (refs.isProne.current || (s.proneTransition > 0 && s.proneTransitionTarget)) {
    targetHeight = PHYSICS.PLAYER_HEIGHT_PRONE;
  } else if (refs.isCrouching.current) {
    targetHeight = PHYSICS.PLAYER_HEIGHT_CROUCH;
  } else {
    targetHeight = PHYSICS.PLAYER_HEIGHT;
  }
  ctx.collider.setHalfHeight(targetHeight / 2 - PHYSICS.PLAYER_RADIUS);

  // Wall running (blocked while prone)
  const isWallRunning = !refs.grounded.current && !combat.isGrappling && !refs.isProne.current && updateWallRun(
    s.wallRunState,
    velocity,
    refs.grounded.current,
    input.left,
    input.right,
    false,
    false,
    s.wallRunState.wallNormal[0],
    s.wallRunState.wallNormal[2],
    dt,
  );

  const canJump = refs.grounded.current || refs.coyoteTime.current > 0;
  const wantsJump = ctx.autoBhop ? input.jump : refs.jumpBufferTime.current > 0;

  // No jumping while prone
  const jumpBlocked = refs.isProne.current || (s.proneTransition > 0);

  if (isWallRunning && wantsJump) {
    wallJump(s.wallRunState, velocity);
    refs.jumpBufferTime.current = 0;
    store.recordJump();
  }

  // Movement with ADS penalty
  const adsFactor = 1 - s.adsProgress * (1 - PHYSICS.ADS_SPEED_MULT);
  const effectiveMaxSpeed = PHYSICS.GROUND_MAX_SPEED * speedMult * adsFactor;
  // effectiveMaxSpeed used implicitly via speedMult passed to accel functions

  if (combat.isGrappling) {
    // Grapple swing already applied in handleGrapple
  } else if (isWallRunning) {
    // Wall running handled by updateWallRun
  } else if (canJump && wantsJump && !jumpBlocked) {
    // Slide-hop: jumping during slide preserves momentum + small boost
    if (refs.isSliding.current) {
      const slideHopBoost = PHYSICS.CROUCH_SLIDE_HOP_BOOST;
      if (hSpeed > 0) {
        velocity.x += (velocity.x / hSpeed) * slideHopBoost;
        velocity.z += (velocity.z / hSpeed) * slideHopBoost;
      }
    }
    velocity.y = PHYSICS.JUMP_FORCE;
    refs.grounded.current = false;
    refs.coyoteTime.current = 0;
    refs.jumpBufferTime.current = 0;
    refs.isJumping.current = true;
    refs.jumpHoldTime.current = 0;
    refs.isSliding.current = false;
    s.slideTimer = 0;
    // Crouch-jump: if holding crouch, keep crouched capsule in air
    if (!wantsCrouch) {
      refs.isCrouching.current = false;
      ctx.collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
    }
    store.recordJump();
    audioManager.play(SOUNDS.JUMP, 0.1);
    if (hasInput) applyAirAcceleration(velocity, wishDir, dt, speedMult);
  } else if (refs.grounded.current) {
    if (s.storedGroundNormal) {
      applySlopeGravity(
        velocity,
        s.storedGroundNormal[0], s.storedGroundNormal[1], s.storedGroundNormal[2],
        PHYSICS.GRAVITY * gravMult, dt,
        PHYSICS.SLOPE_GRAVITY_SCALE, PHYSICS.SLOPE_MIN_ANGLE_DEG,
      );
    }
    if (refs.isProne.current) {
      // Prone: heavy friction, speed capped at PRONE_MAX_SPEED
      applyFriction(velocity, dt * (PHYSICS.PRONE_FRICTION / PHYSICS.GROUND_FRICTION), hasInput, wishDir);
      if (hasInput) {
        applyGroundAcceleration(velocity, wishDir, dt, speedMult);
        // Cap horizontal speed to PRONE_MAX_SPEED
        const pSpeed = getHorizontalSpeed(velocity);
        if (pSpeed > PHYSICS.PRONE_MAX_SPEED) {
          const pScale = PHYSICS.PRONE_MAX_SPEED / pSpeed;
          velocity.x *= pScale;
          velocity.z *= pScale;
        }
      }
    } else if (refs.isSliding.current) {
      // Slide friction ramps up after CROUCH_SLIDE_DURATION
      const ramp = s.slideTimer > PHYSICS.CROUCH_SLIDE_DURATION
        ? 1 + (s.slideTimer - PHYSICS.CROUCH_SLIDE_DURATION) / PHYSICS.CROUCH_SLIDE_DURATION * 3
        : 1;
      applySlideFriction(velocity, dt * ramp);
    } else if (combat.isPlasmaFiring) {
      applyFriction(velocity, dt * PHYSICS.PLASMA_SURF_FRICTION_MULT, hasInput, wishDir);
      if (hasInput) applyGroundAcceleration(velocity, wishDir, dt, speedMult);
    } else {
      applyFriction(velocity, dt, hasInput, wishDir);
      if (hasInput) applyGroundAcceleration(velocity, wishDir, dt, speedMult);
    }
  } else {
    if (hasInput) applyAirAcceleration(velocity, wishDir, dt, speedMult);
    const gravity = (!input.jump && velocity.y > 0 && refs.isJumping.current)
      ? PHYSICS.GRAVITY_JUMP_RELEASE
      : PHYSICS.GRAVITY;
    velocity.y -= gravity * gravMult * dt;
  }

  // Auto-stand on landing if space allows and not holding crouch
  if (refs.grounded.current && !s.wasGrounded && refs.isCrouching.current && !wantsCrouch && !refs.isProne.current) {
    refs.isCrouching.current = false;
    ctx.collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
  }

  // Velocity cap
  const maxSpeed = PHYSICS.MAX_SPEED * speedMult;
  const totalSpeed = velocity.length();
  if (totalSpeed > maxSpeed) {
    velocity.multiplyScalar(maxSpeed / totalSpeed);
  }

  // KCC substepping
  const displacement = totalSpeed * dt;
  const MAX_SUBSTEPS = 4;
  const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(displacement / PHYSICS.MAX_DISPLACEMENT_PER_STEP)));
  const subDt = dt / substeps;

  const pos = ctx.rb.translation();
  _newPos.set(pos.x, pos.y, pos.z);

  let totalDesiredX = 0;
  let totalDesiredZ = 0;
  let totalCorrectedX = 0;
  let totalCorrectedZ = 0;

  for (let step = 0; step < substeps; step++) {
    _desiredTranslation.copy(velocity).multiplyScalar(subDt);
    ctx.controller.computeColliderMovement(ctx.collider, _desiredTranslation, QueryFilterFlags.EXCLUDE_SENSORS);

    const movement = ctx.controller.computedMovement();
    _correctedMovement.set(movement.x, movement.y, movement.z);

    totalDesiredX += _desiredTranslation.x;
    totalDesiredZ += _desiredTranslation.z;
    totalCorrectedX += _correctedMovement.x;
    totalCorrectedZ += _correctedMovement.z;

    _newPos.x += _correctedMovement.x;
    _newPos.y += _correctedMovement.y;
    _newPos.z += _correctedMovement.z;

    ctx.rb.setNextKinematicTranslation(_newPos);
  }

  // Horizontal velocity correction
  if (Math.abs(totalDesiredX) > PHYSICS.SKIN_WIDTH && Math.abs(totalCorrectedX / totalDesiredX) < 0.3) {
    velocity.x = 0;
  }
  if (Math.abs(totalDesiredZ) > PHYSICS.SKIN_WIDTH && Math.abs(totalCorrectedZ / totalDesiredZ) < 0.3) {
    velocity.z = 0;
  }

  // Ground detection
  refs.grounded.current = ctx.controller.computedGrounded();

  // Ground normal for slope physics
  if (refs.grounded.current) {
    const gn = getGroundNormal(ctx.controller, PHYSICS.SLOPE_GROUND_NORMAL_THRESHOLD);
    if (gn) {
      s.storedGroundNormal = gn;
      s.storedGroundNormalY = gn[1];
    } else {
      s.storedGroundNormal = null;
      s.storedGroundNormalY = 1.0;
    }
  } else {
    s.storedGroundNormal = null;
    s.storedGroundNormalY = 1.0;
  }

  // Wall detection from KCC collisions
  const numCollisions = ctx.controller.numComputedCollisions();
  let detectedWallLeft = false;
  let detectedWallRight = false;
  let detectedWallNormalX = 0;
  let detectedWallNormalZ = 0;

  for (let i = 0; i < numCollisions; i++) {
    const collision = ctx.controller.computedCollision(i);
    if (!collision) continue;
    const n1 = collision.normal1;
    if (!n1) continue;
    if (Math.abs(n1.y) < 0.3) {
      const sinYaw = Math.sin(refs.yaw.current);
      const cosYaw = Math.cos(refs.yaw.current);
      const rightX = cosYaw;
      const rightZ = sinYaw;
      const wallDot = n1.x * rightX + n1.z * rightZ;
      if (wallDot > 0.3) {
        detectedWallLeft = true;
        detectedWallNormalX = n1.x;
        detectedWallNormalZ = n1.z;
      } else if (wallDot < -0.3) {
        detectedWallRight = true;
        detectedWallNormalX = n1.x;
        detectedWallNormalZ = n1.z;
      }
    }
  }

  if (!refs.grounded.current && !combat.isGrappling && (detectedWallLeft || detectedWallRight)) {
    updateWallRun(
      s.wallRunState, velocity, refs.grounded.current,
      input.left, input.right,
      detectedWallLeft, detectedWallRight,
      detectedWallNormalX, detectedWallNormalZ,
      0,
    );
  }

  // Landing & footstep audio
  if (refs.grounded.current && !s.wasGrounded) {
    const fallSpeed = Math.abs(velocity.y);
    const landHSpeed = getHorizontalSpeed(velocity);
    if (fallSpeed > 200) audioManager.play(SOUNDS.LAND_HARD, 0.1);
    else audioManager.play(SOUNDS.LAND_SOFT, 0.1);
    if (fallSpeed > LANDING_DIP_MIN_FALL) {
      const intensity = Math.min((fallSpeed - LANDING_DIP_MIN_FALL) / 400, 1);
      s.landingDip = -LANDING_DIP_AMOUNT * intensity;
    }
    devLog.info('Physics', `Landed | fallSpeed=${fallSpeed.toFixed(0)} hSpeed=${landHSpeed.toFixed(0)}`);
  }
  if (refs.grounded.current && hSpeed > 50 && !refs.isSliding.current) {
    s.footstepTimer -= dt;
    if (s.footstepTimer <= 0) {
      const interval = FOOTSTEP_INTERVAL_BASE - (hSpeed / PHYSICS.MAX_SPEED) * (FOOTSTEP_INTERVAL_BASE - FOOTSTEP_INTERVAL_MIN);
      s.footstepTimer = Math.max(interval, FOOTSTEP_INTERVAL_MIN);
      audioManager.playFootstep();
    }
  } else {
    s.footstepTimer = 0;
  }
  s.wasGrounded = refs.grounded.current;

  // Vertical velocity correction
  if (velocity.y > 0 && !refs.isJumping.current && s.mantleTimer <= 0 && _correctedMovement.y < _desiredTranslation.y * 0.5) {
    velocity.y = 0;
  }
  if (refs.grounded.current && velocity.y < 0) {
    velocity.y = 0;
  }

  return numCollisions;
}

function handleMantle(ctx: TickContext): void {
  const { s, refs, velocity, rapierWorld, rb, dt } = ctx;
  const combat = useCombatStore.getState();

  if (s.mantleCooldown > 0) s.mantleCooldown -= dt;

  if (s.mantleTimer > 0) {
    s.mantleTimer -= dt;
    const progress = 1 - Math.max(0, s.mantleTimer / PHYSICS.MANTLE_DURATION);
    const easedProgress = progress * progress * (3 - 2 * progress);

    _newPos.y = s.mantleStartY + (s.mantleTargetY - s.mantleStartY) * easedProgress;
    if (s.mantleTimer <= 0) {
      velocity.set(s.mantleFwdX * PHYSICS.MANTLE_SPEED_BOOST, 0, s.mantleFwdZ * PHYSICS.MANTLE_SPEED_BOOST);
      refs.grounded.current = true;
      refs.isJumping.current = false;
      s.mantleCooldown = PHYSICS.MANTLE_COOLDOWN;
      devLog.info('Physics', `Mantle complete → Y=${_newPos.y.toFixed(1)}`);
    } else {
      velocity.set(0, 0, 0);
    }
    rb.setNextKinematicTranslation(_newPos);
  } else if (
    ctx.edgeGrab &&
    !refs.grounded.current &&
    !s.wallRunState.isWallRunning &&
    !combat.isGrappling &&
    s.mantleCooldown <= 0 &&
    velocity.y < 20
  ) {
    const fwdX = -Math.sin(refs.yaw.current);
    const fwdZ = -Math.cos(refs.yaw.current);
    const approachSpeed = velocity.x * fwdX + velocity.z * fwdZ;

    if (approachSpeed > PHYSICS.MANTLE_MIN_APPROACH_SPEED) {
      const eyeY = _newPos.y + PHYSICS.PLAYER_EYE_OFFSET;

      _mantleRay.origin.x = _newPos.x;
      _mantleRay.origin.y = eyeY;
      _mantleRay.origin.z = _newPos.z;
      _mantleRay.dir.x = fwdX;
      _mantleRay.dir.y = 0;
      _mantleRay.dir.z = fwdZ;

      const wallHit = rapierWorld.castRay(
        _mantleRay, PHYSICS.MANTLE_FORWARD_DIST, true,
        undefined, undefined, undefined, rb,
      );

      if (wallHit) {
        const wallX = _newPos.x + fwdX * wallHit.timeOfImpact;
        const wallZ = _newPos.z + fwdZ * wallHit.timeOfImpact;

        _mantleRay.origin.x = wallX + fwdX * 0.3;
        _mantleRay.origin.y = eyeY + PHYSICS.MANTLE_UP_CHECK;
        _mantleRay.origin.z = wallZ + fwdZ * 0.3;
        _mantleRay.dir.x = 0;
        _mantleRay.dir.y = -1;
        _mantleRay.dir.z = 0;

        const ledgeHit = rapierWorld.castRay(
          _mantleRay, PHYSICS.MANTLE_DOWN_CHECK + PHYSICS.MANTLE_UP_CHECK, true,
          undefined, undefined, undefined, rb,
        );

        if (ledgeHit) {
          const ledgeY = (eyeY + PHYSICS.MANTLE_UP_CHECK) - ledgeHit.timeOfImpact;
          const heightAboveFeet = ledgeY - (_newPos.y - PHYSICS.PLAYER_HEIGHT / 2);

          if (heightAboveFeet >= PHYSICS.MANTLE_MIN_HEIGHT && heightAboveFeet <= PHYSICS.MANTLE_MAX_HEIGHT) {
            s.mantleTimer = PHYSICS.MANTLE_DURATION;
            s.mantleStartY = _newPos.y;
            s.mantleTargetY = ledgeY + PHYSICS.PLAYER_HEIGHT / 2 + 0.1;
            s.mantleFwdX = fwdX;
            s.mantleFwdZ = fwdZ;
            velocity.set(0, 0, 0);
            refs.isJumping.current = false;
            audioManager.play(SOUNDS.LAND_SOFT, 0.1);
            devLog.info('Physics', `Mantle start → ledgeY=${ledgeY.toFixed(1)} height=${heightAboveFeet.toFixed(1)}`);
          }
        }
      }
    }
  }
}

function handleCamera(ctx: TickContext): void {
  const { s, refs, camera, dt } = ctx;

  // Wall run tilt
  let targetTilt = 0;
  if (s.wallRunState.isWallRunning) {
    const sinYaw = Math.sin(refs.yaw.current);
    const cosYaw = Math.cos(refs.yaw.current);
    const wallDot = s.wallRunState.wallNormal[0] * cosYaw + s.wallRunState.wallNormal[2] * sinYaw;
    targetTilt = wallDot > 0 ? -WALL_RUN_TILT : WALL_RUN_TILT;
  }
  s.cameraTilt += (targetTilt - s.cameraTilt) * Math.min(TILT_LERP_SPEED * dt, 1);

  // Landing dip decay
  s.landingDip *= Math.max(0, 1 - LANDING_DIP_DECAY * dt);
  if (Math.abs(s.landingDip) < 0.001) s.landingDip = 0;

  // Slide pitch tilt (head dips forward during slide)
  const slideTiltTarget = refs.isSliding.current ? PHYSICS.CROUCH_SLIDE_TILT : 0;
  s.slidePitchOffset += (slideTiltTarget - s.slidePitchOffset) * Math.min(TILT_LERP_SPEED * dt, 1);
  if (Math.abs(s.slidePitchOffset) < 0.001) s.slidePitchOffset = 0;

  // Camera position/rotation
  let eyeOffset: number;
  if (refs.isProne.current) {
    eyeOffset = PHYSICS.PLAYER_EYE_OFFSET_PRONE;
  } else if (refs.isCrouching.current) {
    eyeOffset = PHYSICS.PLAYER_EYE_OFFSET_CROUCH;
  } else {
    eyeOffset = PHYSICS.PLAYER_EYE_OFFSET;
  }
  camera.position.set(_newPos.x, _newPos.y + eyeOffset + s.landingDip, _newPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = refs.yaw.current;
  camera.rotation.x = refs.pitch.current + s.slidePitchOffset;
  camera.rotation.z = s.cameraTilt;
}

function handleHudAndReplay(ctx: TickContext, numCollisions: number): void {
  const { s, refs, velocity, now, speedMult, gravMult } = ctx;
  const store = useGameStore.getState();
  const combat = useCombatStore.getState();

  // Replay recording
  if (store.runState === RUN_STATES.RUNNING) {
    useReplayStore.getState().recordFrame(
      [_newPos.x, _newPos.y, _newPos.z],
      refs.yaw.current,
      refs.pitch.current,
    );
  }

  // HUD (throttled ~30Hz)
  if (now - s.lastHudUpdate > HUD_UPDATE_INTERVAL) {
    s.lastHudUpdate = now;
    const finalHSpeed = getHorizontalSpeed(velocity);
    const stance: Stance = refs.isProne.current ? 'prone'
      : refs.isSliding.current ? 'sliding'
      : refs.isCrouching.current ? 'crouching'
      : 'standing';
    store.updateHud(finalHSpeed, [_newPos.x, _newPos.y, _newPos.z], refs.grounded.current, stance);
    if (store.timerRunning) store.tickTimer();
    store.tickScreenEffects(1 / HUD_UPDATE_HZ);
  }

  // Dev logging
  if (speedMult !== s.lastDevSpeedMult) {
    devLog.info('Physics', `Speed multiplier → ${speedMult.toFixed(2)}x (maxSpeed=${(PHYSICS.GROUND_MAX_SPEED * speedMult).toFixed(0)} u/s)`);
    s.lastDevSpeedMult = speedMult;
  }
  if (gravMult !== s.lastDevGravMult) {
    devLog.info('Physics', `Gravity multiplier → ${gravMult.toFixed(1)}x (gravity=${(PHYSICS.GRAVITY * gravMult).toFixed(0)} u/s²)`);
    s.lastDevGravMult = gravMult;
  }

  if (now - s.lastDevLogUpdate > DEV_LOG_INTERVAL) {
    s.lastDevLogUpdate = now;
    const hSpd = getHorizontalSpeed(velocity);
    const vSpd = velocity.y;
    const stateLabel = refs.grounded.current ? 'ground' : refs.isJumping.current ? 'jump' : 'air';
    const slide = refs.isSliding.current ? ' [slide]' : '';
    const crouch = refs.isCrouching.current ? ' [crouch]' : '';
    const prone = refs.isProne.current ? ' [prone]' : '';
    const wallRun = s.wallRunState.isWallRunning ? ' [wallrun]' : '';
    const grapple = combat.isGrappling ? ' [grapple]' : '';
    const slope = s.storedGroundNormalY < 0.999 ? ` slope=${getSlopeAngleDeg(s.storedGroundNormalY).toFixed(1)}°` : '';
    devLog.info('Physics',
      `${stateLabel}${slide}${crouch}${prone}${wallRun}${grapple}${slope} | hSpd=${hSpd.toFixed(0)} vSpd=${vSpd.toFixed(0)} | pos=[${_newPos.x.toFixed(1)}, ${_newPos.y.toFixed(1)}, ${_newPos.z.toFixed(1)}] | yaw=${(refs.yaw.current * 180 / Math.PI).toFixed(0)}°`,
    );

    const projCount = activeCount();
    if (projCount > 0) {
      devLog.info('Combat', `${projCount} active projectiles | HP=${combat.health}/${PHYSICS.HEALTH_MAX} | R:${combat.ammo.rocket.current} G:${combat.ammo.grenade.current}`);
    }

    if (numCollisions > 0) {
      devLog.info('Collision', `${numCollisions} contacts`);
    }
  }
}

// ══════════════════════════════════════════════════════════
// Main orchestrator
// ══════════════════════════════════════════════════════════

/** Execute a single 128Hz physics tick */
export function physicsTick(
  refs: PhysicsTickRefs,
  camera: Camera,
  consumeMouseDelta: () => { dx: number; dy: number },
  rapierWorld: import('@dimforge/rapier3d-compat').World,
  state: PhysicsTickState,
  swayState: ReturnType<typeof createScopeSwayState>,
): void {
  const rb = refs.rigidBody.current;
  const collider = refs.collider.current;
  const controller = refs.controller.current;
  if (!rb || !collider || !controller) return;

  const settings = useSettingsStore.getState();
  const ctx: TickContext = {
    s: state,
    swayState,
    refs,
    camera,
    rapierWorld,
    rb,
    collider,
    controller,
    input: refs.input.current,
    velocity: refs.velocity.current,
    dt: PHYSICS.TICK_DELTA,
    speedMult: settings.devSpeedMultiplier,
    gravMult: settings.devGravityMultiplier,
    sensitivity: settings.sensitivity,
    adsSensitivityMult: settings.adsSensitivityMult,
    autoBhop: settings.autoBhop,
    edgeGrab: settings.edgeGrab,
    now: performance.now(),
  };

  // Respawn / grace (may early return)
  if (handleRespawn(ctx, consumeMouseDelta)) return;

  // Mouse look
  const { dx, dy } = consumeMouseDelta();
  handleMouseLook(ctx, dx, dy);

  // Wish direction
  const wishDir = getWishDir(
    ctx.input.forward, ctx.input.backward,
    ctx.input.left, ctx.input.right,
    refs.yaw.current,
  );
  const hasInput = wishDir.lengthSq() > 0;

  // Jump buffer
  if (ctx.input.jump) {
    refs.jumpBufferTime.current = PHYSICS.JUMP_BUFFER_MS;
  } else if (refs.jumpBufferTime.current > 0) {
    refs.jumpBufferTime.current -= ctx.dt * 1000;
  }

  // Coyote time
  if (refs.grounded.current) {
    refs.coyoteTime.current = PHYSICS.COYOTE_TIME_MS;
  } else if (refs.coyoteTime.current > 0 && !refs.isJumping.current) {
    refs.coyoteTime.current -= ctx.dt * 1000;
  }

  // Variable jump height
  if (refs.isJumping.current) {
    refs.jumpHoldTime.current += ctx.dt * 1000;
    if (!ctx.input.jump && ctx.velocity.y > 0 && refs.jumpHoldTime.current < PHYSICS.JUMP_RELEASE_WINDOW_MS) {
      ctx.velocity.y = Math.max(ctx.velocity.y * 0.5, PHYSICS.JUMP_FORCE_MIN * 0.5);
      refs.isJumping.current = false;
    }
    if (refs.grounded.current || ctx.velocity.y <= 0) {
      refs.isJumping.current = false;
    }
  }

  // Set player position for combat/grapple lookups
  const pos = rb.translation();
  _playerPos.set(pos.x, pos.y, pos.z);

  // Fire direction (used by grapple, combat, weapon fire)
  _fireDir.set(
    -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
    Math.sin(refs.pitch.current),
    -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
  ).normalize();

  // Sub-systems
  handleZoneEvents(ctx);
  handleWeaponSwitch(ctx);
  handleGrapple(ctx);
  handleCombatState(ctx, dx, dy);
  handleWeaponFire(ctx);
  handleProjectiles(ctx);

  const numCollisions = handleMovement(ctx, wishDir, hasInput);
  handleMantle(ctx);
  handleCamera(ctx);
  handleHudAndReplay(ctx, numCollisions);
}
