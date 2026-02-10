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
import { useGameStore, RUN_STATES } from '@game/stores/gameStore';
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

const MAX_PITCH = Math.PI / 2 - 0.01;
const HUD_UPDATE_HZ = 30;
const HUD_UPDATE_INTERVAL = 1000 / HUD_UPDATE_HZ;

// Reusable vectors to avoid per-tick allocations
const _desiredTranslation = new Vector3();
const _correctedMovement = new Vector3();
const _newPos = new Vector3();
const _playerPos = new Vector3();
const _fireDir = new Vector3();

// Reusable Ray to avoid per-tick allocations (Rapier Ray origin/dir are mutable)
const _reusableRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

// Pre-allocated tuples for explosion positions — zero GC at 128Hz
const _hitPos: [number, number, number] = [0, 0, 0];
const _gPos: [number, number, number] = [0, 0, 0];

let lastHudUpdate = 0;
let lastScopeSwayUpdate = 0;
let lastDevLogUpdate = 0;
const DEV_LOG_INTERVAL = 2000; // log physics state every 2s
let lastDevSpeedMult = 1.0;
let lastDevGravMult = 1.0;

// Persistent state for wall running (survives across ticks)
let wallRunState: WallRunState = {
  isWallRunning: false,
  wallRunTime: 0,
  wallNormal: [0, 0, 0],
  lastWallNormalX: 0,
  lastWallNormalZ: 0,
  wallRunCooldown: false,
};

// Track input edges (press/release)
let wasGrapplePressed = false;
let wasAltFire = false;

// ADS state (driven each tick, written to store when changed)
let adsProgress = 0;

// Scope sway state (sniper ADS overlay) — uses engine scope sway system
const scopeSwayState = createScopeSwayState();
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

// Camera effects
let cameraTilt = 0;            // Z-axis roll for wall run tilt (radians)
let landingDip = 0;            // Y offset for landing impact
const WALL_RUN_TILT = 0.15;   // max tilt radians (~8.6°)
const TILT_LERP_SPEED = 10;   // how fast tilt changes
const LANDING_DIP_AMOUNT = 0.12;  // max dip in units
const LANDING_DIP_DECAY = 8;      // exponential decay rate
const LANDING_DIP_MIN_FALL = 150;  // min fall speed to trigger dip

// Slope physics: stored ground normal from previous tick's KCC collisions
let storedGroundNormal: [number, number, number] | null = null;
let storedGroundNormalY = 1.0;

// Respawn grace — skip gravity for a few ticks after respawn to let colliders register
let respawnGraceTicks = 0;
const RESPAWN_GRACE_TICKS = 16; // ~125ms at 128Hz

// Audio tracking
let wasGrounded = false;
let footstepTimer = 0;
const FOOTSTEP_INTERVAL_BASE = 0.4;
const FOOTSTEP_INTERVAL_MIN = 0.2;

// Edge grab / mantle state
let mantleTimer = 0;       // >0 = currently mantling (lerp progress)
let mantleCooldown = 0;    // >0 = can't mantle yet
let mantleTargetY = 0;     // target Y position (ledge top)
let mantleStartY = 0;      // starting Y position
let mantleFwdX = 0;        // forward direction during mantle
let mantleFwdZ = 0;
const _mantleRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

/** Reset all module-level physics state. Call on map load / game restart. */
export function resetPhysicsTickState(): void {
  wallRunState.isWallRunning = false;
  wallRunState.wallRunTime = 0;
  wallRunState.wallNormal[0] = 0; wallRunState.wallNormal[1] = 0; wallRunState.wallNormal[2] = 0;
  wallRunState.lastWallNormalX = 0;
  wallRunState.lastWallNormalZ = 0;
  wallRunState.wallRunCooldown = false;

  wasGrapplePressed = false;
  wasAltFire = false;
  adsProgress = 0;
  cameraTilt = 0;
  landingDip = 0;
  respawnGraceTicks = 0;
  wasGrounded = false;
  footstepTimer = 0;

  mantleTimer = 0;
  mantleCooldown = 0;
  mantleTargetY = 0;
  mantleStartY = 0;
  mantleFwdX = 0;
  mantleFwdZ = 0;

  storedGroundNormal = null;
  storedGroundNormalY = 1.0;

  lastHudUpdate = 0;
  lastScopeSwayUpdate = 0;
  resetScopeSwayState(scopeSwayState);
  lastDevLogUpdate = 0;
  lastDevSpeedMult = 1.0;
  lastDevGravMult = 1.0;
}

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
  input: MutableRefObject<InputState>;
}

/** Execute a single 128Hz physics tick */
export function physicsTick(
  refs: PhysicsTickRefs,
  camera: Camera,
  consumeMouseDelta: () => { dx: number; dy: number },
  rapierWorld: import('@dimforge/rapier3d-compat').World,
): void {
  const rb = refs.rigidBody.current;
  const collider = refs.collider.current;
  const controller = refs.controller.current;
  if (!rb || !collider || !controller) return;

  const input = refs.input.current;
  const velocity = refs.velocity.current;
  const { sensitivity, adsSensitivityMult, autoBhop, edgeGrab, devSpeedMultiplier, devGravityMultiplier } = useSettingsStore.getState();
  const dt = PHYSICS.TICK_DELTA;
  const speedMult = devSpeedMultiplier;
  const gravMult = devGravityMultiplier;

  // --- Respawn check (use actual physics position, not HUD position) ---
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
    refs.isJumping.current = false;
    refs.coyoteTime.current = 0;
    refs.jumpHoldTime.current = 0;
    wallRunState.isWallRunning = false;
    wallRunState.wallRunCooldown = false;
    mantleTimer = 0;
    mantleCooldown = 0;
    respawnGraceTicks = RESPAWN_GRACE_TICKS;
    collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
    camera.position.set(respawn.pos[0], respawn.pos[1] + PHYSICS.PLAYER_EYE_OFFSET, respawn.pos[2]);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = respawn.yaw;
    camera.rotation.x = 0;
    useCombatStore.getState().stopGrapple();
    devLog.info('Physics', `Respawn → [${respawn.pos.map(v => v.toFixed(1)).join(', ')}] yaw=${(respawn.yaw * 180 / Math.PI).toFixed(0)}°`);
    return;
  }

  // Respawn grace: skip gravity to let colliders register in physics world
  if (respawnGraceTicks > 0) {
    respawnGraceTicks--;
    // Allow mouse look but hold position
    const { dx: gDx, dy: gDy } = consumeMouseDelta();
    refs.yaw.current -= gDx * sensitivity;
    refs.pitch.current -= gDy * sensitivity;
    refs.pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, refs.pitch.current));
    camera.position.set(pos.x, pos.y + PHYSICS.PLAYER_EYE_OFFSET, pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = refs.yaw.current;
    camera.rotation.x = refs.pitch.current;
    return;
  }

  // --- Mouse look (with ADS sensitivity reduction) ---
  const { dx, dy } = consumeMouseDelta();
  const effectiveSens = sensitivity * (1 - adsProgress * (1 - adsSensitivityMult));
  refs.yaw.current -= dx * effectiveSens;
  refs.pitch.current -= dy * effectiveSens;
  refs.pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, refs.pitch.current));

  // --- Wish direction ---
  const wishDir = getWishDir(
    input.forward, input.backward,
    input.left, input.right,
    refs.yaw.current,
  );
  const hasInput = wishDir.lengthSq() > 0;

  // --- Jump buffer ---
  if (input.jump) {
    refs.jumpBufferTime.current = PHYSICS.JUMP_BUFFER_MS;
  } else if (refs.jumpBufferTime.current > 0) {
    refs.jumpBufferTime.current -= dt * 1000;
  }

  // --- Coyote time ---
  if (refs.grounded.current) {
    refs.coyoteTime.current = PHYSICS.COYOTE_TIME_MS;
  } else if (refs.coyoteTime.current > 0 && !refs.isJumping.current) {
    refs.coyoteTime.current -= dt * 1000;
  }

  const canJump = refs.grounded.current || refs.coyoteTime.current > 0;
  const wantsJump = autoBhop ? input.jump : refs.jumpBufferTime.current > 0;

  // --- Variable jump height ---
  if (refs.isJumping.current) {
    refs.jumpHoldTime.current += dt * 1000;
    if (!input.jump && velocity.y > 0 && refs.jumpHoldTime.current < PHYSICS.JUMP_RELEASE_WINDOW_MS) {
      velocity.y = Math.max(velocity.y * 0.5, PHYSICS.JUMP_FORCE_MIN * 0.5);
      refs.isJumping.current = false;
    }
    if (refs.grounded.current || velocity.y <= 0) {
      refs.isJumping.current = false;
    }
  }

  // --- Combat store reads ---
  const combat = useCombatStore.getState();

  // --- Process zone events (from sensor callbacks) ---
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

  // --- Weapon switching (number keys + scroll wheel) ---
  if (input.weaponSlot > 0) {
    combat.switchWeaponBySlot(input.weaponSlot);
    input.weaponSlot = 0;
  }
  if (input.scrollDelta !== 0) {
    combat.scrollWeapon(input.scrollDelta > 0 ? 1 : -1);
    input.scrollDelta = 0;
  }

  // --- Grappling hook (free-aim: raycast to find surface) ---
  const grapplePressed = input.grapple;
  const grappleJustPressed = grapplePressed && !wasGrapplePressed;
  wasGrapplePressed = grapplePressed;

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

    // Free-aim grapple: first check registered points, then raycast walls
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

    // If no grapple point found, raycast to nearest surface
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

  // --- Weapon firing ---
  combat.tickCooldown(dt);

  // Compute fire direction from camera
  _fireDir.set(
    -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
    Math.sin(refs.pitch.current),
    -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
  ).normalize();

  const eyeOff = refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;
  const weapon = combat.activeWeapon;
  const canFireNow = combat.fireCooldown <= 0 && combat.swapCooldown <= 0;

  // --- ADS state machine (hold altFire for weapons that support ADS) ---
  const adsTarget = (input.altFire && ADS_CONFIG[weapon].canAds && combat.swapCooldown <= 0) ? 1 : 0;
  const prevAds = adsProgress;
  adsProgress += (adsTarget - adsProgress) * (1 - Math.exp(-PHYSICS.ADS_TRANSITION_SPEED * dt));
  // Snap to target when close enough
  if (Math.abs(adsProgress - adsTarget) < 0.005) adsProgress = adsTarget;
  // Write to store only when changed (avoid unnecessary set calls at 128Hz)
  if (Math.abs(adsProgress - prevAds) > 0.001) {
    useCombatStore.setState({ adsProgress });
  }
  wasAltFire = input.altFire;

  // --- Sniper scope sway / breath hold / unsteadiness ---
  const isSniperScoped = weapon === 'sniper' && adsProgress > 0.9;
  if (isSniperScoped) {
    const mouseMag = Math.sqrt(dx * dx + dy * dy);
    tickScopeSway(scopeSwayState, scopeSwayConfig, dt, input.crouch, mouseMag);

    // Force unscope
    if (scopeSwayState.forceUnscope) {
      adsProgress = 0;
      useCombatStore.setState({ adsProgress: 0 });
    }

    // Write scope state to store at ~30Hz (matches HUD update rate)
    const now = performance.now();
    if (now - lastScopeSwayUpdate > HUD_UPDATE_INTERVAL) {
      lastScopeSwayUpdate = now;
      useCombatStore.setState({
        scopeSwayX: scopeSwayState.swayX,
        scopeSwayY: scopeSwayState.swayY,
        isHoldingBreath: scopeSwayState.isHoldingBreath,
        breathHoldTime: scopeSwayState.breathHoldTime,
        scopeTime: scopeSwayState.scopeTime,
      });
    }
  } else if (scopeSwayState.scopeTime > 0 || scopeSwayState.swayX !== 0 || scopeSwayState.swayY !== 0) {
    // Reset scope state when not scoped
    resetScopeSwayState(scopeSwayState);
    lastScopeSwayUpdate = 0;
    useCombatStore.setState({
      scopeSwayX: 0, scopeSwayY: 0,
      isHoldingBreath: false, breathHoldTime: 0, scopeTime: 0,
    });
  }

  // Knife lunge movement (applied during lunge timer)
  if (combat.knifeLungeTimer > 0) {
    const ld = combat.knifeLungeDir;
    velocity.x = ld[0] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.z = ld[2] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.y = Math.max(velocity.y, ld[1] * PHYSICS.KNIFE_LUNGE_SPEED * 0.3);
  }

  // Plasma beam tick — plasma surf: pushback + reduced friction for surfing movement
  if (weapon === 'plasma' && input.fire && combat.ammo.plasma.current > 0) {
    if (!combat.isPlasmaFiring) combat.startPlasma();
    combat.tickPlasma(dt);
    // Continuous self-pushback opposite to aim (plasma surf)
    velocity.x -= _fireDir.x * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.y -= _fireDir.y * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.z -= _fireDir.z * PHYSICS.PLASMA_PUSHBACK * dt;
    // Ensure uplift when aimed downward while grounded
    if (refs.grounded.current && _fireDir.y < -0.3 && velocity.y < 60) {
      velocity.y = 60;
      refs.grounded.current = false;
    }
  } else if (combat.isPlasmaFiring) {
    combat.stopPlasma();
  }

  if (input.fire && canFireNow) {
    switch (weapon) {
      case 'rocket': {
        if (combat.ammo.rocket.current > 0) {
          const sx = _playerPos.x + _fireDir.x;
          const sy = _playerPos.y + eyeOff + _fireDir.y;
          const sz = _playerPos.z + _fireDir.z;
          spawnProjectile('rocket', sx, sy, sz,
            _fireDir.x * PHYSICS.ROCKET_SPEED, _fireDir.y * PHYSICS.ROCKET_SPEED, _fireDir.z * PHYSICS.ROCKET_SPEED);
          // Only update ammo in Zustand (UI-relevant)
          const newAmmo = combat.ammo.rocket.current - 1;
          useCombatStore.setState((s) => ({
            rocketAmmo: newAmmo,
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
            grenadeAmmo: newAmmo,
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
          // Hitscan raycast
          _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
          _reusableRay.dir.x = _fireDir.x; _reusableRay.dir.y = _fireDir.y; _reusableRay.dir.z = _fireDir.z;
          const sniperHit = rapierWorld.castRayAndGetNormal(_reusableRay, PHYSICS.SNIPER_RANGE, true, undefined, undefined, undefined, rb);
          if (sniperHit) {
            const shx = _playerPos.x + _fireDir.x * sniperHit.timeOfImpact;
            const shy = (_playerPos.y + eyeOff) + _fireDir.y * sniperHit.timeOfImpact;
            const shz = _playerPos.z + _fireDir.z * sniperHit.timeOfImpact;
            spawnWallSparks(shx, shy, shz, sniperHit.normal.x, sniperHit.normal.y, sniperHit.normal.z, 'heavy');
            pushHitMarker();
          }
          // Self-knockback backward
          velocity.x -= _fireDir.x * PHYSICS.SNIPER_KNOCKBACK;
          velocity.y -= _fireDir.y * PHYSICS.SNIPER_KNOCKBACK;
          velocity.z -= _fireDir.z * PHYSICS.SNIPER_KNOCKBACK;
          audioManager.play(SOUNDS.ROCKET_FIRE); // reuse sound for now
          devLog.info('Combat', `Sniper fired → ammo=${combat.ammo.sniper.current}`);
        }
        break;
      }
      case 'assault': {
        if (combat.fireHitscan('assault')) {
          // Spread: random offset within cone
          const spreadX = (nextRandom() - 0.5) * PHYSICS.ASSAULT_SPREAD * 2;
          const spreadY = (nextRandom() - 0.5) * PHYSICS.ASSAULT_SPREAD * 2;
          const aimX = _fireDir.x + spreadX;
          const aimY = _fireDir.y + spreadY;
          const aimZ = _fireDir.z;
          const aimLen = Math.sqrt(aimX * aimX + aimY * aimY + aimZ * aimZ);
          _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
          _reusableRay.dir.x = aimX / aimLen; _reusableRay.dir.y = aimY / aimLen; _reusableRay.dir.z = aimZ / aimLen;
          const arHit = rapierWorld.castRayAndGetNormal(_reusableRay, PHYSICS.ASSAULT_RANGE, true, undefined, undefined, undefined, rb);
          if (arHit) {
            const hx = _reusableRay.origin.x + (aimX / aimLen) * arHit.timeOfImpact;
            const hy = _reusableRay.origin.y + (aimY / aimLen) * arHit.timeOfImpact;
            const hz = _reusableRay.origin.z + (aimZ / aimLen) * arHit.timeOfImpact;
            spawnWallSparks(hx, hy, hz, arHit.normal.x, arHit.normal.y, arHit.normal.z, 'light');
            pushHitMarker();
          }
          // Small knockback
          velocity.x -= _fireDir.x * PHYSICS.ASSAULT_KNOCKBACK * dt;
          velocity.z -= _fireDir.z * PHYSICS.ASSAULT_KNOCKBACK * dt;
          audioManager.play(SOUNDS.LAND_SOFT, 0.05); // light tick sound
        }
        break;
      }
      case 'shotgun': {
        if (combat.fireHitscan('shotgun')) {
          // Fire pellets in a cone — limit physical raycasts to 4 representative rays
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
            const hit = rapierWorld.castRayAndGetNormal(_reusableRay, PHYSICS.SHOTGUN_RANGE, true, undefined, undefined, undefined, rb);
            if (hit) {
              const hx = _reusableRay.origin.x + (px / pl) * hit.timeOfImpact;
              const hy = _reusableRay.origin.y + (py / pl) * hit.timeOfImpact;
              const hz = _reusableRay.origin.z + (pz / pl) * hit.timeOfImpact;
              spawnWallSparks(hx, hy, hz, hit.normal.x, hit.normal.y, hit.normal.z, 'medium');
            }
          }
          // Consume remaining PRNG values to keep determinism regardless of pellet cap
          for (let i = physicalPellets; i < PHYSICS.SHOTGUN_PELLETS; i++) {
            nextRandom(); nextRandom();
          }
          pushHitMarker();
          // Shotgun jump — strong directional knockback opposite to aim
          velocity.x -= _fireDir.x * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
          velocity.y -= _fireDir.y * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
          velocity.z -= _fireDir.z * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
          // Ensure grounded players get lifted (like rocket jump)
          if (refs.grounded.current && velocity.y < PHYSICS.SHOTGUN_JUMP_UPLIFT) {
            velocity.y = PHYSICS.SHOTGUN_JUMP_UPLIFT;
            refs.grounded.current = false;
          }
          audioManager.play(SOUNDS.ROCKET_EXPLODE); // reuse explosive sound
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
        // Handled above in continuous beam section
        break;
    }
  }

  // --- Projectile collision via raycasts (mutable pool, zero GC) ---
  const now = performance.now();
  const pool = getPool();
  const poolSize = getPoolSize();

  for (let i = 0; i < poolSize; i++) {
    const p = pool[i];
    if (!p.active) continue;

    const age = (now - p.spawnTime) / 1000;

    // Safety: remove projectiles that fell off map or timed out
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

      // Raycast margin: at least projectile radius to catch near-contact hits
      const hit = rapierWorld.castRayAndGetNormal(_reusableRay, travelDist + PHYSICS.ROCKET_RADIUS + 0.3, true, undefined, undefined, undefined, rb);

      if (hit) {
        _hitPos[0] = p.posX + dirX * hit.timeOfImpact;
        _hitPos[1] = p.posY + dirY * hit.timeOfImpact;
        _hitPos[2] = p.posZ + dirZ * hit.timeOfImpact;
        const damage = applyExplosionKnockback(
          velocity, _playerPos, _hitPos,
          PHYSICS.ROCKET_EXPLOSION_RADIUS, PHYSICS.ROCKET_KNOCKBACK_FORCE, PHYSICS.ROCKET_DAMAGE * PHYSICS.ROCKET_SELF_DAMAGE_MULT,
          refs.grounded.current,
        );
        if (damage > 0) {
          refs.grounded.current = false;
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.ROCKET_DAMAGE, 1) * 0.7);
        }
        audioManager.play(SOUNDS.ROCKET_EXPLODE);
        useExplosionStore.getState().spawnExplosion(_hitPos, '#ff6600', 8.0);
        spawnDecal(_hitPos[0], _hitPos[1], _hitPos[2], hit.normal.x, hit.normal.y, hit.normal.z, 2.0, 0.08, 0.05, 0.03);
        deactivateAt(i);
        devLog.info('Combat', `Rocket exploded at [${_hitPos[0].toFixed(1)}, ${_hitPos[1].toFixed(1)}, ${_hitPos[2].toFixed(1)}] dmg=${damage.toFixed(0)}`);
      }
    } else if (p.type === 'grenade') {
      // Grenade fuse check
      if (age >= PHYSICS.GRENADE_FUSE_TIME) {
        _gPos[0] = p.posX; _gPos[1] = p.posY; _gPos[2] = p.posZ;
        const damage = applyExplosionKnockback(
          velocity, _playerPos, _gPos,
          PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, PHYSICS.GRENADE_DAMAGE * PHYSICS.ROCKET_SELF_DAMAGE_MULT,
          refs.grounded.current,
        );
        if (damage > 0) {
          refs.grounded.current = false;
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
        }
        audioManager.play(SOUNDS.GRENADE_EXPLODE);
        useExplosionStore.getState().spawnExplosion(_gPos, '#22c55e', 3.5);
        spawnDecal(_gPos[0], _gPos[1], _gPos[2], 0, 1, 0, 1.5, 0.05, 0.12, 0.04);
        deactivateAt(i);
        continue;
      }

      // Grenade bounce raycast
      const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY + p.velZ * p.velZ);
      if (speed < 0.01) continue;

      const dirX = p.velX / speed;
      const dirY = p.velY / speed;
      const dirZ = p.velZ / speed;
      const travelDist = speed * dt;

      _reusableRay.origin.x = p.posX; _reusableRay.origin.y = p.posY; _reusableRay.origin.z = p.posZ;
      _reusableRay.dir.x = dirX; _reusableRay.dir.y = dirY; _reusableRay.dir.z = dirZ;

      const hit = rapierWorld.castRayAndGetNormal(_reusableRay, travelDist + PHYSICS.GRENADE_RADIUS + 0.3, true, undefined, undefined, undefined, rb);

      if (hit) {
        if (p.bounces >= 1) {
          _gPos[0] = p.posX; _gPos[1] = p.posY; _gPos[2] = p.posZ;
          const damage = applyExplosionKnockback(
            velocity, _playerPos, _gPos,
            PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, PHYSICS.GRENADE_DAMAGE * PHYSICS.ROCKET_SELF_DAMAGE_MULT,
            refs.grounded.current,
          );
          if (damage > 0) {
            refs.grounded.current = false;
            combat.takeDamage(damage);
            store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
          }
          audioManager.play(SOUNDS.GRENADE_EXPLODE);
          useExplosionStore.getState().spawnExplosion(_gPos, '#22c55e', 3.5);
          spawnDecal(_gPos[0], _gPos[1], _gPos[2], hit.normal.x, hit.normal.y, hit.normal.z, 1.5, 0.05, 0.12, 0.04);
          deactivateAt(i);
        } else {
          // Reflect velocity off surface normal — mutate in-place, zero GC
          const normal = hit.normal;
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

  // Update positions in-place (zero alloc)
  updatePositions(dt, PHYSICS.GRAVITY);

  // --- Health regen ---
  combat.regenTick(dt);

  // --- Crouch sliding ---
  const wantsCrouch = input.crouch;
  const hSpeed = getHorizontalSpeed(velocity);

  if (refs.grounded.current && wantsCrouch) {
    if (!refs.isCrouching.current && hSpeed >= PHYSICS.CROUCH_SLIDE_MIN_SPEED) {
      refs.isSliding.current = true;
      const boost = PHYSICS.CROUCH_SLIDE_BOOST;
      if (hSpeed > 0) {
        velocity.x += (velocity.x / hSpeed) * boost;
        velocity.z += (velocity.z / hSpeed) * boost;
      }
    }
    refs.isCrouching.current = true;
    if (refs.isSliding.current && hSpeed < PHYSICS.CROUCH_SLIDE_MIN_SPEED * 0.5) {
      refs.isSliding.current = false;
    }
  } else {
    refs.isCrouching.current = wantsCrouch && !refs.grounded.current;
    refs.isSliding.current = false;
  }

  const targetHalfHeight = refs.isCrouching.current
    ? PHYSICS.PLAYER_HEIGHT_CROUCH / 2 - PHYSICS.PLAYER_RADIUS
    : PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS;
  collider.setHalfHeight(targetHalfHeight);

  // --- Wall running ---
  const isWallRunning = !refs.grounded.current && !combat.isGrappling && updateWallRun(
    wallRunState,
    velocity,
    refs.grounded.current,
    input.left,
    input.right,
    false,
    false,
    wallRunState.wallNormal[0],
    wallRunState.wallNormal[2],
    dt,
  );

  if (isWallRunning && wantsJump) {
    wallJump(wallRunState, velocity);
    refs.jumpBufferTime.current = 0;
    store.recordJump();
  }

  // --- Movement (with dev speed/gravity multipliers + ADS penalty) ---
  const adsFactor = 1 - adsProgress * (1 - PHYSICS.ADS_SPEED_MULT);
  const effectiveMaxSpeed = PHYSICS.GROUND_MAX_SPEED * speedMult * adsFactor;

  if (combat.isGrappling) {
    // Grapple swing already applied above
  } else if (isWallRunning) {
    // Wall running handled by updateWallRun
  } else if (canJump && wantsJump) {
    velocity.y = PHYSICS.JUMP_FORCE;
    refs.grounded.current = false;
    refs.coyoteTime.current = 0;
    refs.jumpBufferTime.current = 0;
    refs.isJumping.current = true;
    refs.jumpHoldTime.current = 0;
    refs.isSliding.current = false;
    refs.isCrouching.current = false;
    collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
    store.recordJump();
    audioManager.play(SOUNDS.JUMP, 0.1);
    if (hasInput) applyAirAcceleration(velocity, wishDir, dt, speedMult);
  } else if (refs.grounded.current) {
    // Slope gravity: project gravity along slope surface (uses previous tick's normal)
    if (storedGroundNormal) {
      applySlopeGravity(
        velocity,
        storedGroundNormal[0], storedGroundNormal[1], storedGroundNormal[2],
        PHYSICS.GRAVITY * gravMult, dt,
        PHYSICS.SLOPE_GRAVITY_SCALE, PHYSICS.SLOPE_MIN_ANGLE_DEG,
      );
    }

    if (refs.isSliding.current) {
      applySlideFriction(velocity, dt);
    } else if (combat.isPlasmaFiring) {
      // Plasma surf: reduced friction while firing plasma on ground
      applyFriction(velocity, dt * PHYSICS.PLASMA_SURF_FRICTION_MULT, hasInput, wishDir);
      if (hasInput) applyGroundAcceleration(velocity, wishDir, dt, speedMult);
    } else {
      applyFriction(velocity, dt, hasInput, wishDir);
      if (hasInput) applyGroundAcceleration(velocity, wishDir, dt, speedMult);
    }
  } else {
    // Airborne
    if (hasInput) applyAirAcceleration(velocity, wishDir, dt, speedMult);
    const gravity = (!input.jump && velocity.y > 0 && refs.isJumping.current)
      ? PHYSICS.GRAVITY_JUMP_RELEASE
      : PHYSICS.GRAVITY;
    velocity.y -= gravity * gravMult * dt;
  }

  // --- Velocity cap (safety limit, scaled by speedMult) ---
  const maxSpeed = PHYSICS.MAX_SPEED * speedMult;
  const totalSpeed = velocity.length();
  if (totalSpeed > maxSpeed) {
    velocity.multiplyScalar(maxSpeed / totalSpeed);
  }

  // --- Character controller with substepping (capped to prevent spiral of death) ---
  const displacement = totalSpeed * dt;
  const MAX_SUBSTEPS = 4;
  const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(displacement / PHYSICS.MAX_DISPLACEMENT_PER_STEP)));
  const subDt = dt / substeps;

  _newPos.set(pos.x, pos.y, pos.z);

  // Accumulate total desired vs corrected movement across all substeps
  // to decide velocity correction AFTER the loop (not mid-loop which kills remaining substeps)
  let totalDesiredX = 0;
  let totalDesiredZ = 0;
  let totalCorrectedX = 0;
  let totalCorrectedZ = 0;

  for (let step = 0; step < substeps; step++) {
    _desiredTranslation.copy(velocity).multiplyScalar(subDt);
    controller.computeColliderMovement(collider, _desiredTranslation, QueryFilterFlags.EXCLUDE_SENSORS);

    const movement = controller.computedMovement();
    _correctedMovement.set(movement.x, movement.y, movement.z);

    totalDesiredX += _desiredTranslation.x;
    totalDesiredZ += _desiredTranslation.z;
    totalCorrectedX += _correctedMovement.x;
    totalCorrectedZ += _correctedMovement.z;

    _newPos.x += _correctedMovement.x;
    _newPos.y += _correctedMovement.y;
    _newPos.z += _correctedMovement.z;

    rb.setNextKinematicTranslation(_newPos);
  }

  // --- Horizontal velocity correction (post-substep) ---
  // Zero velocity on an axis only when a real wall collision blocks significant movement
  // across the entire tick. This prevents "sticky walls" from killing velocity mid-substep.
  if (Math.abs(totalDesiredX) > PHYSICS.SKIN_WIDTH && Math.abs(totalCorrectedX / totalDesiredX) < 0.3) {
    velocity.x = 0;
  }
  if (Math.abs(totalDesiredZ) > PHYSICS.SKIN_WIDTH && Math.abs(totalCorrectedZ / totalDesiredZ) < 0.3) {
    velocity.z = 0;
  }

  // --- Ground detection ---
  refs.grounded.current = controller.computedGrounded();

  // --- Ground normal for slope physics (store for next tick) ---
  if (refs.grounded.current) {
    const gn = getGroundNormal(controller, PHYSICS.SLOPE_GROUND_NORMAL_THRESHOLD);
    if (gn) {
      storedGroundNormal = gn;
      storedGroundNormalY = gn[1];
    } else {
      storedGroundNormal = null;
      storedGroundNormalY = 1.0;
    }
  } else {
    storedGroundNormal = null;
    storedGroundNormalY = 1.0;
  }

  // --- Wall detection from KCC collisions ---
  const numCollisions = controller.numComputedCollisions();
  let detectedWallLeft = false;
  let detectedWallRight = false;
  let detectedWallNormalX = 0;
  let detectedWallNormalZ = 0;

  for (let i = 0; i < numCollisions; i++) {
    const collision = controller.computedCollision(i);
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
      wallRunState, velocity, refs.grounded.current,
      input.left, input.right,
      detectedWallLeft, detectedWallRight,
      detectedWallNormalX, detectedWallNormalZ,
      0,
    );
  }

  // --- Landing & footstep audio ---
  if (refs.grounded.current && !wasGrounded) {
    const fallSpeed = Math.abs(velocity.y);
    const landHSpeed = getHorizontalSpeed(velocity);
    if (fallSpeed > 200) audioManager.play(SOUNDS.LAND_HARD, 0.1);
    else audioManager.play(SOUNDS.LAND_SOFT, 0.1);
    // Landing camera dip — proportional to fall speed
    if (fallSpeed > LANDING_DIP_MIN_FALL) {
      const intensity = Math.min((fallSpeed - LANDING_DIP_MIN_FALL) / 400, 1);
      landingDip = -LANDING_DIP_AMOUNT * intensity;
    }
    devLog.info('Physics', `Landed | fallSpeed=${fallSpeed.toFixed(0)} hSpeed=${landHSpeed.toFixed(0)}`);
  }
  if (refs.grounded.current && hSpeed > 50 && !refs.isSliding.current) {
    footstepTimer -= dt;
    if (footstepTimer <= 0) {
      const interval = FOOTSTEP_INTERVAL_BASE - (hSpeed / PHYSICS.MAX_SPEED) * (FOOTSTEP_INTERVAL_BASE - FOOTSTEP_INTERVAL_MIN);
      footstepTimer = Math.max(interval, FOOTSTEP_INTERVAL_MIN);
      audioManager.playFootstep();
    }
  } else {
    footstepTimer = 0;
  }
  wasGrounded = refs.grounded.current;

  // --- Vertical velocity correction ---
  // Only zero upward velocity for ceiling hits (not during initial jump frames
  // where snap-to-ground may fight the small vertical displacement)
  if (velocity.y > 0 && !refs.isJumping.current && mantleTimer <= 0 && _correctedMovement.y < _desiredTranslation.y * 0.5) {
    velocity.y = 0;
  }
  if (refs.grounded.current && velocity.y < 0) {
    velocity.y = 0;
  }

  // --- Edge grab / mantle ---
  if (mantleCooldown > 0) mantleCooldown -= dt;

  if (mantleTimer > 0) {
    // Currently mantling — lerp position upward + block input
    mantleTimer -= dt;
    const progress = 1 - Math.max(0, mantleTimer / PHYSICS.MANTLE_DURATION);
    const easedProgress = progress * progress * (3 - 2 * progress); // smoothstep

    _newPos.y = mantleStartY + (mantleTargetY - mantleStartY) * easedProgress;
    // Small forward push at end of mantle
    if (mantleTimer <= 0) {
      velocity.set(mantleFwdX * PHYSICS.MANTLE_SPEED_BOOST, 0, mantleFwdZ * PHYSICS.MANTLE_SPEED_BOOST);
      refs.grounded.current = true;
      refs.isJumping.current = false;
      mantleCooldown = PHYSICS.MANTLE_COOLDOWN;
      devLog.info('Physics', `Mantle complete → Y=${_newPos.y.toFixed(1)}`);
    } else {
      velocity.set(0, 0, 0);
    }
    rb.setNextKinematicTranslation(_newPos);
  } else if (
    edgeGrab &&
    !refs.grounded.current &&
    !wallRunState.isWallRunning &&
    !combat.isGrappling &&
    mantleCooldown <= 0 &&
    velocity.y <= 0 // only grab when falling or at apex
  ) {
    // Edge detection: raycast forward from chest height
    const fwdX = -Math.sin(refs.yaw.current);
    const fwdZ = -Math.cos(refs.yaw.current);

    // Check approach speed (must be moving toward wall)
    const approachSpeed = velocity.x * fwdX + velocity.z * fwdZ;
    if (approachSpeed > PHYSICS.MANTLE_MIN_APPROACH_SPEED) {
      const eyeY = _newPos.y + PHYSICS.PLAYER_EYE_OFFSET;

      // Ray 1: Forward from eye level — detect wall
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
        // Ray 2: Upward from wall hit point — check no ceiling
        const wallX = _newPos.x + fwdX * wallHit.timeOfImpact;
        const wallZ = _newPos.z + fwdZ * wallHit.timeOfImpact;

        _mantleRay.origin.x = wallX + fwdX * 0.3; // slightly past wall
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
            // Initiate mantle
            mantleTimer = PHYSICS.MANTLE_DURATION;
            mantleStartY = _newPos.y;
            mantleTargetY = ledgeY + PHYSICS.PLAYER_HEIGHT / 2 + 0.1; // feet on ledge
            mantleFwdX = fwdX;
            mantleFwdZ = fwdZ;
            velocity.set(0, 0, 0);
            refs.isJumping.current = false;
            audioManager.play(SOUNDS.LAND_SOFT, 0.1);
            devLog.info('Physics', `Mantle start → ledgeY=${ledgeY.toFixed(1)} height=${heightAboveFeet.toFixed(1)}`);
          }
        }
      }
    }
  }

  // --- Camera effects ---
  // Wall run tilt: lean into the wall
  let targetTilt = 0;
  if (wallRunState.isWallRunning) {
    // Determine which side the wall is on via wall normal dot with camera right
    const sinYaw = Math.sin(refs.yaw.current);
    const cosYaw = Math.cos(refs.yaw.current);
    const wallDot = wallRunState.wallNormal[0] * cosYaw + wallRunState.wallNormal[2] * sinYaw;
    targetTilt = wallDot > 0 ? -WALL_RUN_TILT : WALL_RUN_TILT;
  }
  cameraTilt += (targetTilt - cameraTilt) * Math.min(TILT_LERP_SPEED * dt, 1);

  // Landing dip decay
  landingDip *= Math.max(0, 1 - LANDING_DIP_DECAY * dt);
  if (Math.abs(landingDip) < 0.001) landingDip = 0;

  // --- Camera ---
  const eyeOffset = refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;
  camera.position.set(_newPos.x, _newPos.y + eyeOffset + landingDip, _newPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = refs.yaw.current;
  camera.rotation.x = refs.pitch.current;
  camera.rotation.z = cameraTilt;

  // --- Replay recording ---
  if (store.runState === RUN_STATES.RUNNING) {
    useReplayStore.getState().recordFrame(
      [_newPos.x, _newPos.y, _newPos.z],
      refs.yaw.current,
      refs.pitch.current,
    );
  }

  // --- HUD (throttled ~30Hz) ---
  if (now - lastHudUpdate > HUD_UPDATE_INTERVAL) {
    lastHudUpdate = now;
    const finalHSpeed = getHorizontalSpeed(velocity);
    store.updateHud(finalHSpeed, [_newPos.x, _newPos.y, _newPos.z], refs.grounded.current);
    if (store.timerRunning) store.tickTimer();
    store.tickScreenEffects(1 / HUD_UPDATE_HZ);
  }

  // --- Dev logging (throttled ~0.5Hz) ---
  // Log multiplier changes immediately
  if (speedMult !== lastDevSpeedMult) {
    devLog.info('Physics', `Speed multiplier → ${speedMult.toFixed(2)}x (maxSpeed=${(PHYSICS.GROUND_MAX_SPEED * speedMult).toFixed(0)} u/s)`);
    lastDevSpeedMult = speedMult;
  }
  if (gravMult !== lastDevGravMult) {
    devLog.info('Physics', `Gravity multiplier → ${gravMult.toFixed(1)}x (gravity=${(PHYSICS.GRAVITY * gravMult).toFixed(0)} u/s²)`);
    lastDevGravMult = gravMult;
  }

  // Periodic physics state dump
  if (now - lastDevLogUpdate > DEV_LOG_INTERVAL) {
    lastDevLogUpdate = now;
    const hSpd = getHorizontalSpeed(velocity);
    const vSpd = velocity.y;
    const state = refs.grounded.current ? 'ground' : refs.isJumping.current ? 'jump' : 'air';
    const slide = refs.isSliding.current ? ' [slide]' : '';
    const crouch = refs.isCrouching.current ? ' [crouch]' : '';
    const wallRun = wallRunState.isWallRunning ? ' [wallrun]' : '';
    const grapple = combat.isGrappling ? ' [grapple]' : '';
    const slope = storedGroundNormalY < 0.999 ? ` slope=${getSlopeAngleDeg(storedGroundNormalY).toFixed(1)}°` : '';
    devLog.info('Physics',
      `${state}${slide}${crouch}${wallRun}${grapple}${slope} | hSpd=${hSpd.toFixed(0)} vSpd=${vSpd.toFixed(0)} | pos=[${_newPos.x.toFixed(1)}, ${_newPos.y.toFixed(1)}, ${_newPos.z.toFixed(1)}] | yaw=${(refs.yaw.current * 180 / Math.PI).toFixed(0)}°`,
    );

    // Log projectile count if any
    const projCount = activeCount();
    if (projCount > 0) {
      devLog.info('Combat', `${projCount} active projectiles | HP=${combat.health}/${PHYSICS.HEALTH_MAX} | R:${combat.rocketAmmo} G:${combat.grenadeAmmo}`);
    }

    // Log collisions if hitting walls
    if (numCollisions > 0) {
      devLog.info('Collision', `${numCollisions} contacts | substeps=${substeps}`);
    }
  }
}
