import { type MutableRefObject } from 'react';
import { Vector3, type Camera } from 'three';
import type { RapierRigidBody, RapierCollider } from '@react-three/rapier';
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
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useCombatStore } from '../../../stores/combatStore';

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

// Persistent state for wall running (survives across ticks)
let wallRunState: WallRunState = {
  isWallRunning: false,
  wallRunTime: 0,
  wallNormal: [0, 0, 0],
  lastWallNormalX: 0,
  lastWallNormalZ: 0,
  wallRunCooldown: false,
};

// Track grapple input edge (press/release)
let wasGrapplePressed = false;

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
  isCrouching: MutableRefObject<boolean>;
  isSliding: MutableRefObject<boolean>;
  input: MutableRefObject<InputState>;
}

/** Execute a single 128Hz physics tick */
export function physicsTick(
  refs: PhysicsTickRefs,
  camera: Camera,
  consumeMouseDelta: () => { dx: number; dy: number },
): void {
  const rb = refs.rigidBody.current;
  const collider = refs.collider.current;
  const controller = refs.controller.current;
  if (!rb || !collider || !controller) return;

  const input = refs.input.current;
  const velocity = refs.velocity.current;
  const { sensitivity, autoBhop } = useSettingsStore.getState();
  const dt = PHYSICS.TICK_DELTA;

  // --- Respawn check ---
  const store = useGameStore.getState();
  if (store.checkKillZone()) {
    store.requestRespawn();
  }
  const respawn = store.consumeRespawn();
  if (respawn) {
    rb.setNextKinematicTranslation({ x: respawn.pos[0], y: respawn.pos[1], z: respawn.pos[2] });
    _newPos.set(respawn.pos[0], respawn.pos[1], respawn.pos[2]);
    velocity.set(0, 0, 0);
    refs.yaw.current = respawn.yaw;
    refs.pitch.current = 0;
    refs.grounded.current = false;
    refs.isCrouching.current = false;
    refs.isSliding.current = false;
    wallRunState.isWallRunning = false;
    wallRunState.wallRunCooldown = false;
    collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
    camera.position.set(respawn.pos[0], respawn.pos[1] + PHYSICS.PLAYER_EYE_OFFSET, respawn.pos[2]);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = respawn.yaw;
    camera.rotation.x = 0;
    useCombatStore.getState().stopGrapple();
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

  const wantsJump = autoBhop ? input.jump : refs.jumpBufferTime.current > 0;

  // --- Combat store reads ---
  const combat = useCombatStore.getState();

  // --- Process zone events (from sensor callbacks) ---
  const zoneEvents = combat.drainZoneEvents();
  for (const evt of zoneEvents) {
    switch (evt.type) {
      case 'boostPad':
        applyBoostPad(velocity, evt.direction, evt.speed);
        break;
      case 'launchPad':
        applyLaunchPad(velocity, evt.direction, evt.speed);
        refs.grounded.current = false;
        break;
      case 'speedGate':
        applySpeedGate(velocity, evt.multiplier, evt.minSpeed);
        break;
      case 'ammoPickup':
        combat.pickupAmmo(evt.weaponType, evt.amount);
        break;
    }
  }

  // --- Grappling hook ---
  const grapplePressed = input.grapple;
  const grappleJustPressed = grapplePressed && !wasGrapplePressed;
  wasGrapplePressed = grapplePressed;

  const pos = rb.translation();
  _playerPos.set(pos.x, pos.y, pos.z);

  if (combat.isGrappling) {
    if (!grapplePressed && combat.grappleTarget) {
      // Release: boost momentum
      const speed = velocity.length();
      velocity.multiplyScalar(PHYSICS.GRAPPLE_RELEASE_BOOST);
      // Ensure we don't lose speed on release
      if (velocity.length() < speed) {
        velocity.normalize().multiplyScalar(speed * PHYSICS.GRAPPLE_RELEASE_BOOST);
      }
      combat.stopGrapple();
    } else if (combat.grappleTarget) {
      // Active grapple: apply swing physics
      applyGrappleSwing(velocity, _playerPos, combat.grappleTarget, combat.grappleLength, dt);
    }
  } else if (grappleJustPressed) {
    // Try to find nearest grapple point within range and in view direction
    const grapplePoints = combat.registeredGrapplePoints;
    let bestDist = PHYSICS.GRAPPLE_MAX_DISTANCE;
    let bestPoint: [number, number, number] | null = null;

    // Look direction from yaw/pitch
    _fireDir.set(
      -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
      Math.sin(refs.pitch.current),
      -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
    ).normalize();

    for (const gp of grapplePoints) {
      const gpDx = gp[0] - _playerPos.x;
      const gpDy = gp[1] - _playerPos.y;
      const gpDz = gp[2] - _playerPos.z;
      const dist = Math.sqrt(gpDx * gpDx + gpDy * gpDy + gpDz * gpDz);
      if (dist > PHYSICS.GRAPPLE_MAX_DISTANCE || dist < 1) continue;

      // Check if roughly in view direction (dot product > 0.3 = ~70 degree cone)
      const dot = (gpDx / dist) * _fireDir.x + (gpDy / dist) * _fireDir.y + (gpDz / dist) * _fireDir.z;
      if (dot < 0.3) continue;

      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = gp;
      }
    }

    if (bestPoint) {
      combat.startGrapple(bestPoint, bestDist);
    }
  }

  // --- Weapon firing ---
  // Left-click = rocket, Right-click/G = grenade (independent cooldowns via shared cooldown timer)
  combat.tickCooldown(dt);

  if (input.fire && combat.fireCooldown <= 0 && combat.rocketAmmo > 0) {
    _fireDir.set(
      -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
      Math.sin(refs.pitch.current),
      -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
    ).normalize();

    const eyeOff = refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;
    const spawnPos: [number, number, number] = [
      _playerPos.x + _fireDir.x * 1.0,
      _playerPos.y + eyeOff + _fireDir.y * 1.0,
      _playerPos.z + _fireDir.z * 1.0,
    ];
    const rocketVel: [number, number, number] = [
      _fireDir.x * PHYSICS.ROCKET_SPEED,
      _fireDir.y * PHYSICS.ROCKET_SPEED,
      _fireDir.z * PHYSICS.ROCKET_SPEED,
    ];
    combat.fireRocket(spawnPos, rocketVel);
  }

  if (input.altFire && combat.fireCooldown <= 0 && combat.grenadeAmmo > 0) {
    _fireDir.set(
      -Math.sin(refs.yaw.current) * Math.cos(refs.pitch.current),
      Math.sin(refs.pitch.current),
      -Math.cos(refs.yaw.current) * Math.cos(refs.pitch.current),
    ).normalize();

    const eyeOff = refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;
    const spawnPos: [number, number, number] = [
      _playerPos.x + _fireDir.x * 0.8,
      _playerPos.y + eyeOff + _fireDir.y * 0.8,
      _playerPos.z + _fireDir.z * 0.8,
    ];
    const grenadeVel: [number, number, number] = [
      _fireDir.x * PHYSICS.GRENADE_SPEED,
      _fireDir.y * PHYSICS.GRENADE_SPEED + 100, // slight upward arc
      _fireDir.z * PHYSICS.GRENADE_SPEED,
    ];
    combat.fireGrenade(spawnPos, grenadeVel);
  }

  // --- Update projectiles & check explosions ---
  combat.updateProjectiles(dt);

  // Check for expired grenades (fuse expired) and apply explosions
  const now = performance.now();
  const projectiles = useCombatStore.getState().projectiles;
  for (const p of projectiles) {
    if (p.type === 'grenade') {
      const age = (now - p.spawnTime) / 1000;
      if (age >= PHYSICS.GRENADE_FUSE_TIME) {
        // Grenade explodes
        const damage = applyExplosionKnockback(
          velocity, _playerPos, p.position,
          PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, true,
        );
        if (damage > 0) {
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
        }
        combat.removeProjectile(p.id);
      }
    }

    // Remove projectiles that have traveled too far (> 200 units from spawn) or below kill zone
    if (p.position[1] < -60) {
      combat.removeProjectile(p.id);
    }
  }

  // Simple rocket collision: rockets that hit the ground (y <= 0.1) or traveled > 5 seconds
  for (const p of useCombatStore.getState().projectiles) {
    if (p.type === 'rocket') {
      const age = (now - p.spawnTime) / 1000;
      if (p.position[1] <= 0.1 || age > 5) {
        // Rocket explodes
        const damage = applyExplosionKnockback(
          velocity, _playerPos, p.position,
          PHYSICS.ROCKET_EXPLOSION_RADIUS, PHYSICS.ROCKET_KNOCKBACK_FORCE, true,
        );
        if (damage > 0) {
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.ROCKET_DAMAGE, 1) * 0.7);
        }
        combat.removeProjectile(p.id);
      }
    }
  }

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
  // Simple wall detection using KCC: check if horizontal movement was blocked
  const isWallRunning = !refs.grounded.current && !combat.isGrappling && updateWallRun(
    wallRunState,
    velocity,
    refs.grounded.current,
    input.left,
    input.right,
    false, // wall detection is simplified — computed below from KCC collisions
    false,
    wallRunState.wallNormal[0],
    wallRunState.wallNormal[2],
    dt,
  );

  // Wall jump: if wall running and jump pressed
  if (isWallRunning && wantsJump) {
    wallJump(wallRunState, velocity);
    refs.jumpBufferTime.current = 0;
    store.recordJump();
  }

  // --- Movement ---
  if (combat.isGrappling) {
    // While grappling, skip normal movement (grapple swing already applied above)
  } else if (isWallRunning) {
    // Wall running: no normal gravity/movement applied (handled by updateWallRun)
  } else if (refs.grounded.current) {
    if (wantsJump) {
      velocity.y = PHYSICS.JUMP_FORCE;
      refs.grounded.current = false;
      refs.jumpBufferTime.current = 0;
      refs.isSliding.current = false;
      refs.isCrouching.current = false;
      collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
      store.recordJump();
      if (hasInput) applyAirAcceleration(velocity, wishDir, dt);
    } else if (refs.isSliding.current) {
      applySlideFriction(velocity, dt);
    } else {
      applyFriction(velocity, dt);
      if (hasInput) applyGroundAcceleration(velocity, wishDir, dt);
    }
  } else {
    if (hasInput) applyAirAcceleration(velocity, wishDir, dt);
    velocity.y -= PHYSICS.GRAVITY * dt;
  }

  // --- Character controller ---
  _desiredTranslation.copy(velocity).multiplyScalar(dt);
  controller.computeColliderMovement(collider, _desiredTranslation);

  const movement = controller.computedMovement();
  _correctedMovement.set(movement.x, movement.y, movement.z);

  _newPos.set(
    pos.x + _correctedMovement.x,
    pos.y + _correctedMovement.y,
    pos.z + _correctedMovement.z,
  );
  rb.setNextKinematicTranslation(_newPos);

  // --- Ground detection ---
  refs.grounded.current = controller.computedGrounded();

  // --- Wall detection from KCC collisions ---
  // After computing movement, check if we hit a wall (for wall running next tick)
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
    // Wall = mostly horizontal normal (y close to 0)
    if (Math.abs(n1.y) < 0.3) {
      // Determine which side the wall is on
      const sinYaw = Math.sin(refs.yaw.current);
      const cosYaw = Math.cos(refs.yaw.current);
      // Player right vector
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

  // Update wall run with detected walls for next tick
  if (!refs.grounded.current && !combat.isGrappling && (detectedWallLeft || detectedWallRight)) {
    updateWallRun(
      wallRunState, velocity, refs.grounded.current,
      input.left, input.right,
      detectedWallLeft, detectedWallRight,
      detectedWallNormalX, detectedWallNormalZ,
      0, // dt=0 since we already advanced time above
    );
  }

  // --- Collision velocity correction ---
  if (velocity.y > 0 && _correctedMovement.y < _desiredTranslation.y * 0.5) {
    velocity.y = 0;
  }
  if (refs.grounded.current && velocity.y < 0) {
    velocity.y = 0;
  }

  // --- Camera ---
  const eyeOffset = refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;
  camera.position.set(_newPos.x, _newPos.y + eyeOffset, _newPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = refs.yaw.current;
  camera.rotation.x = refs.pitch.current;

  // --- HUD (throttled ~30Hz) ---
  if (now - lastHudUpdate > HUD_UPDATE_INTERVAL) {
    lastHudUpdate = now;
    const speed = getHorizontalSpeed(velocity);
    store.updateHud(speed, [_newPos.x, _newPos.y, _newPos.z], refs.grounded.current);
    if (store.timerRunning) store.tickTimer();
  }
}
