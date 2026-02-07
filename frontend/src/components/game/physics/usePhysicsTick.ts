import { type MutableRefObject } from 'react';
import { Vector3, type Camera } from 'three';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
import { Ray, QueryFilterFlags } from '@dimforge/rapier3d-compat';
import { PHYSICS } from './constants';
import type { InputState } from './types';
import {
  applyFriction,
  applySlideFriction,
  applyGroundAcceleration,
  applyAirAcceleration,
  getWishDir,
  getHorizontalSpeed,
} from './useMovement';
import {
  applyGrappleSwing,
  applyExplosionKnockback,
  applyBoostPad,
  applyLaunchPad,
  applySpeedGate,
  type WallRunState,
  updateWallRun,
  wallJump,
} from './useAdvancedMovement';
import { useGameStore, RUN_STATES } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useCombatStore } from '../../../stores/combatStore';
import { useReplayStore } from '../../../stores/replayStore';
import { audioManager, SOUNDS } from '../../../systems/AudioManager';
import { useExplosionStore } from '../effects/ExplosionEffect';
import { devLog } from '../../../stores/devLogStore';

const MAX_PITCH = Math.PI / 2 - 0.01;
const HUD_UPDATE_HZ = 30;
const HUD_UPDATE_INTERVAL = 1000 / HUD_UPDATE_HZ;

// Reusable vectors to avoid per-tick allocations
const _desiredTranslation = new Vector3();
const _correctedMovement = new Vector3();
const _newPos = new Vector3();
const _playerPos = new Vector3();
const _fireDir = new Vector3();

let lastHudUpdate = 0;
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

// Camera effects
let cameraTilt = 0;            // Z-axis roll for wall run tilt (radians)
let landingDip = 0;            // Y offset for landing impact
const WALL_RUN_TILT = 0.15;   // max tilt radians (~8.6°)
const TILT_LERP_SPEED = 10;   // how fast tilt changes
const LANDING_DIP_AMOUNT = 0.12;  // max dip in units
const LANDING_DIP_DECAY = 8;      // exponential decay rate
const LANDING_DIP_MIN_FALL = 150;  // min fall speed to trigger dip

// Respawn grace — skip gravity for a few ticks after respawn to let colliders register
let respawnGraceTicks = 0;
const RESPAWN_GRACE_TICKS = 16; // ~125ms at 128Hz

// Audio tracking
let wasGrounded = false;
let footstepTimer = 0;
const FOOTSTEP_INTERVAL_BASE = 0.4;
const FOOTSTEP_INTERVAL_MIN = 0.2;

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
  const { sensitivity, autoBhop, devSpeedMultiplier, devGravityMultiplier } = useSettingsStore.getState();
  const dt = PHYSICS.TICK_DELTA;
  const speedMult = devSpeedMultiplier;
  const gravMult = devGravityMultiplier;

  // --- Respawn check (use actual physics position, not HUD position) ---
  const store = useGameStore.getState();
  const pos = rb.translation();
  if (pos.y < -50) {
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

  // --- Mouse look ---
  const { dx, dy } = consumeMouseDelta();
  refs.yaw.current -= dx * sensitivity;
  refs.pitch.current -= dy * sensitivity;
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
      const grappleRay = new Ray(
        { x: _playerPos.x, y: _playerPos.y, z: _playerPos.z },
        { x: _fireDir.x, y: _fireDir.y, z: _fireDir.z },
      );
      const grappleHit = rapierWorld.castRay(grappleRay, PHYSICS.GRAPPLE_MAX_DISTANCE, true, undefined, undefined, undefined, rb);
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

  // Sniper zoom toggle (right-click when sniper is active)
  if (weapon === 'sniper' && input.altFire && !wasAltFire) {
    useCombatStore.setState({ isZoomed: !combat.isZoomed });
  }
  wasAltFire = input.altFire;

  // Knife lunge movement (applied during lunge timer)
  if (combat.knifeLungeTimer > 0) {
    const ld = combat.knifeLungeDir;
    velocity.x = ld[0] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.z = ld[2] * PHYSICS.KNIFE_LUNGE_SPEED;
    velocity.y = Math.max(velocity.y, ld[1] * PHYSICS.KNIFE_LUNGE_SPEED * 0.3);
  }

  // Plasma beam tick
  if (weapon === 'plasma' && input.fire && combat.ammo.plasma.current > 0) {
    if (!combat.isPlasmaFiring) combat.startPlasma();
    combat.tickPlasma(dt);
    // Self-pushback (mini-boost in aim direction)
    velocity.x -= _fireDir.x * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.y -= _fireDir.y * PHYSICS.PLASMA_PUSHBACK * dt;
    velocity.z -= _fireDir.z * PHYSICS.PLASMA_PUSHBACK * dt;
  } else if (combat.isPlasmaFiring) {
    combat.stopPlasma();
  }

  if (input.fire && canFireNow) {
    switch (weapon) {
      case 'rocket': {
        if (combat.ammo.rocket.current > 0) {
          const spawnPos: [number, number, number] = [
            _playerPos.x + _fireDir.x, _playerPos.y + eyeOff + _fireDir.y, _playerPos.z + _fireDir.z,
          ];
          const rocketVel: [number, number, number] = [
            _fireDir.x * PHYSICS.ROCKET_SPEED, _fireDir.y * PHYSICS.ROCKET_SPEED, _fireDir.z * PHYSICS.ROCKET_SPEED,
          ];
          combat.fireRocket(spawnPos, rocketVel);
          audioManager.play(SOUNDS.ROCKET_FIRE);
          devLog.info('Combat', `Rocket fired → ammo=${combat.ammo.rocket.current - 1}`);
        }
        break;
      }
      case 'grenade': {
        if (combat.ammo.grenade.current > 0) {
          const spawnPos: [number, number, number] = [
            _playerPos.x + _fireDir.x * 0.8, _playerPos.y + eyeOff + _fireDir.y * 0.8, _playerPos.z + _fireDir.z * 0.8,
          ];
          const grenadeVel: [number, number, number] = [
            _fireDir.x * PHYSICS.GRENADE_SPEED, _fireDir.y * PHYSICS.GRENADE_SPEED + 100, _fireDir.z * PHYSICS.GRENADE_SPEED,
          ];
          combat.fireGrenade(spawnPos, grenadeVel);
          audioManager.play(SOUNDS.GRENADE_THROW);
          devLog.info('Combat', `Grenade thrown → ammo=${combat.ammo.grenade.current - 1}`);
        }
        break;
      }
      case 'sniper': {
        if (combat.fireHitscan('sniper')) {
          // Hitscan raycast
          const sniperRay = new Ray(
            { x: _playerPos.x, y: _playerPos.y + eyeOff, z: _playerPos.z },
            { x: _fireDir.x, y: _fireDir.y, z: _fireDir.z },
          );
          rapierWorld.castRay(sniperRay, PHYSICS.SNIPER_RANGE, true, undefined, undefined, undefined, rb);
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
          const spreadX = (Math.random() - 0.5) * PHYSICS.ASSAULT_SPREAD * 2;
          const spreadY = (Math.random() - 0.5) * PHYSICS.ASSAULT_SPREAD * 2;
          const aimX = _fireDir.x + spreadX;
          const aimY = _fireDir.y + spreadY;
          const aimZ = _fireDir.z;
          const aimLen = Math.sqrt(aimX * aimX + aimY * aimY + aimZ * aimZ);
          const assaultRay = new Ray(
            { x: _playerPos.x, y: _playerPos.y + eyeOff, z: _playerPos.z },
            { x: aimX / aimLen, y: aimY / aimLen, z: aimZ / aimLen },
          );
          rapierWorld.castRay(assaultRay, PHYSICS.ASSAULT_RANGE, true, undefined, undefined, undefined, rb);
          // Small knockback
          velocity.x -= _fireDir.x * PHYSICS.ASSAULT_KNOCKBACK * dt;
          velocity.z -= _fireDir.z * PHYSICS.ASSAULT_KNOCKBACK * dt;
          audioManager.play(SOUNDS.LAND_SOFT, 0.05); // light tick sound
        }
        break;
      }
      case 'shotgun': {
        if (combat.fireHitscan('shotgun')) {
          // Fire multiple pellets in a cone
          for (let i = 0; i < PHYSICS.SHOTGUN_PELLETS; i++) {
            const sx = (Math.random() - 0.5) * PHYSICS.SHOTGUN_SPREAD * 2;
            const sy = (Math.random() - 0.5) * PHYSICS.SHOTGUN_SPREAD * 2;
            const px = _fireDir.x + sx;
            const py = _fireDir.y + sy;
            const pz = _fireDir.z;
            const pl = Math.sqrt(px * px + py * py + pz * pz);
            const shotRay = new Ray(
              { x: _playerPos.x, y: _playerPos.y + eyeOff, z: _playerPos.z },
              { x: px / pl, y: py / pl, z: pz / pl },
            );
            rapierWorld.castRay(shotRay, PHYSICS.SHOTGUN_RANGE, true, undefined, undefined, undefined, rb);
          }
          // Strong self-knockback (shotgun jump!)
          velocity.x -= _fireDir.x * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
          velocity.y -= _fireDir.y * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
          velocity.z -= _fireDir.z * PHYSICS.SHOTGUN_SELF_KNOCKBACK;
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

  // --- Projectile collision via raycasts (BEFORE position update) ---
  const now = performance.now();
  const projectiles = combat.projectiles;
  const removedIds: number[] = [];

  for (const p of projectiles) {
    const age = (now - p.spawnTime) / 1000;

    // Safety: remove projectiles that fell off map or timed out
    if (p.position[1] < -60 || age > 8) {
      removedIds.push(p.id);
      continue;
    }

    if (p.type === 'rocket') {
      // Raycast from current position along velocity to detect wall/floor hits
      const speed = Math.sqrt(
        p.velocity[0] * p.velocity[0] + p.velocity[1] * p.velocity[1] + p.velocity[2] * p.velocity[2],
      );
      if (speed < 0.01) { removedIds.push(p.id); continue; }

      const dirX = p.velocity[0] / speed;
      const dirY = p.velocity[1] / speed;
      const dirZ = p.velocity[2] / speed;
      const travelDist = speed * dt;

      const ray = new Ray(
        { x: p.position[0], y: p.position[1], z: p.position[2] },
        { x: dirX, y: dirY, z: dirZ },
      );

      const hit = rapierWorld.castRay(ray, travelDist + 0.5, true, undefined, undefined, undefined, rb);

      if (hit) {
        const hitPos: [number, number, number] = [
          p.position[0] + dirX * hit.timeOfImpact,
          p.position[1] + dirY * hit.timeOfImpact,
          p.position[2] + dirZ * hit.timeOfImpact,
        ];
        const damage = applyExplosionKnockback(
          velocity, _playerPos, hitPos,
          PHYSICS.ROCKET_EXPLOSION_RADIUS, PHYSICS.ROCKET_KNOCKBACK_FORCE, true,
        );
        if (damage > 0) {
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.ROCKET_DAMAGE, 1) * 0.7);
        }
        audioManager.play(SOUNDS.ROCKET_EXPLODE);
        useExplosionStore.getState().spawnExplosion(hitPos, '#ff6600', 2.0);
        removedIds.push(p.id);
        devLog.info('Combat', `Rocket exploded at [${hitPos.map(v => v.toFixed(1)).join(', ')}] dmg=${damage.toFixed(0)}`);
      }
    } else if (p.type === 'grenade') {
      // Grenade fuse check — explode when expired
      if (age >= PHYSICS.GRENADE_FUSE_TIME) {
        const damage = applyExplosionKnockback(
          velocity, _playerPos, p.position,
          PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, true,
        );
        if (damage > 0) {
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
        }
        audioManager.play(SOUNDS.GRENADE_EXPLODE);
        useExplosionStore.getState().spawnExplosion(p.position, '#22c55e', 1.0);
        removedIds.push(p.id);
        continue;
      }

      // Grenade bounce: raycast to detect surface collision
      const speed = Math.sqrt(
        p.velocity[0] * p.velocity[0] + p.velocity[1] * p.velocity[1] + p.velocity[2] * p.velocity[2],
      );
      if (speed < 0.01) continue;

      const dirX = p.velocity[0] / speed;
      const dirY = p.velocity[1] / speed;
      const dirZ = p.velocity[2] / speed;
      const travelDist = speed * dt;

      const ray = new Ray(
        { x: p.position[0], y: p.position[1], z: p.position[2] },
        { x: dirX, y: dirY, z: dirZ },
      );

      const hit = rapierWorld.castRayAndGetNormal(ray, travelDist + 0.5, true, undefined, undefined, undefined, rb);

      if (hit) {
        if (p.bounces >= 1) {
          // Explode on second bounce
          const damage = applyExplosionKnockback(
            velocity, _playerPos, p.position,
            PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, true,
          );
          if (damage > 0) {
            combat.takeDamage(damage);
            store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
          }
          audioManager.play(SOUNDS.GRENADE_EXPLODE);
          useExplosionStore.getState().spawnExplosion(p.position, '#22c55e', 1.0);
          removedIds.push(p.id);
        } else {
          // Reflect velocity off surface normal
          const normal = hit.normal;
          const dot = p.velocity[0] * normal.x + p.velocity[1] * normal.y + p.velocity[2] * normal.z;
          const damp = PHYSICS.GRENADE_BOUNCE_DAMPING;
          const newVel: [number, number, number] = [
            (p.velocity[0] - 2 * dot * normal.x) * damp,
            (p.velocity[1] - 2 * dot * normal.y) * damp,
            (p.velocity[2] - 2 * dot * normal.z) * damp,
          ];
          useCombatStore.setState((s) => ({
            projectiles: s.projectiles.map((proj) =>
              proj.id === p.id ? { ...proj, velocity: newVel, bounces: proj.bounces + 1 } : proj,
            ),
          }));
        }
      }
    }
  }

  // Batch-remove exploded/expired projectiles, then update positions
  if (removedIds.length > 0) {
    useCombatStore.setState((s) => ({
      projectiles: s.projectiles.filter((p) => !removedIds.includes(p.id)),
    }));
  }
  combat.updateProjectiles(dt);

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

  // --- Movement (with dev speed/gravity multipliers) ---
  const effectiveMaxSpeed = PHYSICS.GROUND_MAX_SPEED * speedMult;

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
    if (refs.isSliding.current) {
      applySlideFriction(velocity, dt);
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

  // --- Character controller with substepping ---
  const displacement = totalSpeed * dt;
  const substeps = Math.max(1, Math.ceil(displacement / PHYSICS.MAX_DISPLACEMENT_PER_STEP));
  const subDt = dt / substeps;

  _newPos.set(pos.x, pos.y, pos.z);

  for (let step = 0; step < substeps; step++) {
    _desiredTranslation.copy(velocity).multiplyScalar(subDt);
    controller.computeColliderMovement(collider, _desiredTranslation, QueryFilterFlags.EXCLUDE_SENSORS);

    const movement = controller.computedMovement();
    _correctedMovement.set(movement.x, movement.y, movement.z);

    // --- Horizontal velocity correction ---
    // Zero velocity on an axis only when a real wall collision blocks significant movement.
    // The minimum threshold (SKIN_WIDTH) prevents small air-strafe velocities from being
    // killed by floating-point noise in computeColliderMovement.
    const desiredX = _desiredTranslation.x;
    const desiredZ = _desiredTranslation.z;
    if (Math.abs(desiredX) > PHYSICS.SKIN_WIDTH && Math.abs(_correctedMovement.x / desiredX) < 0.3) {
      velocity.x = 0;
    }
    if (Math.abs(desiredZ) > PHYSICS.SKIN_WIDTH && Math.abs(_correctedMovement.z / desiredZ) < 0.3) {
      velocity.z = 0;
    }

    _newPos.x += _correctedMovement.x;
    _newPos.y += _correctedMovement.y;
    _newPos.z += _correctedMovement.z;

    rb.setNextKinematicTranslation(_newPos);
  }

  // --- Ground detection ---
  refs.grounded.current = controller.computedGrounded();

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
  if (velocity.y > 0 && !refs.isJumping.current && _correctedMovement.y < _desiredTranslation.y * 0.5) {
    velocity.y = 0;
  }
  if (refs.grounded.current && velocity.y < 0) {
    velocity.y = 0;
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
    devLog.info('Physics',
      `${state}${slide}${crouch}${wallRun}${grapple} | hSpd=${hSpd.toFixed(0)} vSpd=${vSpd.toFixed(0)} | pos=[${_newPos.x.toFixed(1)}, ${_newPos.y.toFixed(1)}, ${_newPos.z.toFixed(1)}] | yaw=${(refs.yaw.current * 180 / Math.PI).toFixed(0)}°`,
    );

    // Log projectile count if any
    if (combat.projectiles.length > 0) {
      devLog.info('Combat', `${combat.projectiles.length} active projectiles | HP=${combat.health}/${PHYSICS.HEALTH_MAX} | R:${combat.rocketAmmo} G:${combat.grenadeAmmo}`);
    }

    // Log collisions if hitting walls
    if (numCollisions > 0) {
      devLog.info('Collision', `${numCollisions} contacts | substeps=${substeps}`);
    }
  }
}
