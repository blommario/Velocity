/**
 * Movement tick -- Quake-style ground/air acceleration, stance state machine (crouch/slide/prone), sub-stepped KCC collision, wall-run detection, and mantle logic.
 * Depends on: engine useMovement/slopeDetection/useAdvancedMovement, gameStore, combatStore, AudioManager, PHYSICS constants
 * Used by: PlayerController (physics tick)
 */
import { type Vector3 } from 'three';
import { QueryFilterFlags } from '@dimforge/rapier3d-compat';
import { PHYSICS } from './constants';
import type { TickContext } from './state';
import { _desiredTranslation, _correctedMovement, _newPos, _mantleRay } from './scratch';
import {
  applyFriction, applySlideFriction, applyGroundAcceleration,
  applyAirAcceleration, applySlopeGravity, getHorizontalSpeed,
} from '@engine/physics/useMovement';
import { getGroundNormal, getSlopeAngleDeg } from '@engine/physics/slopeDetection';
import { updateWallRun, wallJump } from '@engine/physics/useAdvancedMovement';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';
import { devLog } from '@engine/stores/devLogStore';

export { getHorizontalSpeed, getSlopeAngleDeg };

const LANDING_DIP_AMOUNT = 0.12;
const LANDING_DIP_MIN_FALL = 150;
const FOOTSTEP_INTERVAL_BASE = 0.4;
const FOOTSTEP_INTERVAL_MIN = 0.2;
const MAX_SUBSTEPS = 4;

export function handleMovement(ctx: TickContext, wishDir: Vector3, hasInput: boolean): number {
  const { s, refs, velocity, dt, speedMult, gravMult, input } = ctx;
  const combat = useCombatStore.getState();
  const store = useGameStore.getState();

  // ── Stance state machine ──
  const wantsCrouch = input.crouch;
  const wantsProne = input.prone;
  const hSpeed = getHorizontalSpeed(velocity);

  const now_stance = ctx.now;
  const doubleTapProne = wantsCrouch && !refs.isCrouching.current && !refs.isProne.current
    && (now_stance - s.lastCrouchPress < PHYSICS.DOUBLE_TAP_WINDOW);
  if (wantsCrouch && !refs.isCrouching.current && !refs.isProne.current && s.lastCrouchPress === 0) {
    s.lastCrouchPress = now_stance;
  }
  if (!wantsCrouch) {
    if (s.lastCrouchPress > 0 && now_stance - s.lastCrouchPress > PHYSICS.DOUBLE_TAP_WINDOW) {
      s.lastCrouchPress = 0;
    }
  }

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
        refs.isCrouching.current = true;
      }
    }
  }

  if ((wantsProne || doubleTapProne) && refs.grounded.current
      && !refs.isProne.current && s.proneTransition <= 0 && !refs.isSliding.current) {
    s.proneTransition = PHYSICS.PRONE_TRANSITION_TIME;
    s.proneTransitionTarget = true;
    refs.isCrouching.current = true;
    refs.isSliding.current = false;
    s.lastCrouchPress = 0;
    audioManager.play(SOUNDS.LAND_SOFT, 0.08);
  }

  if (refs.isProne.current && !wantsProne && !wantsCrouch && s.proneTransition <= 0) {
    s.proneTransition = PHYSICS.PRONE_STAND_UP_TIME;
    s.proneTransitionTarget = false;
  }

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
      if (refs.isSliding.current) {
        s.slideTimer += dt;
        if (hSpeed < PHYSICS.CROUCH_SLIDE_MIN_SPEED * 0.5 || s.slideTimer > PHYSICS.CROUCH_SLIDE_DURATION * 1.5) {
          refs.isSliding.current = false;
          s.slideTimer = 0;
        }
      }
    } else if (!refs.grounded.current) {
      refs.isCrouching.current = wantsCrouch;
      refs.isSliding.current = false;
      s.slideTimer = 0;
    } else {
      refs.isCrouching.current = false;
      refs.isSliding.current = false;
      s.slideTimer = 0;
    }
  }

  let targetHeight: number;
  if (refs.isProne.current || (s.proneTransition > 0 && s.proneTransitionTarget)) {
    targetHeight = PHYSICS.PLAYER_HEIGHT_PRONE;
  } else if (refs.isCrouching.current) {
    targetHeight = PHYSICS.PLAYER_HEIGHT_CROUCH;
  } else {
    targetHeight = PHYSICS.PLAYER_HEIGHT;
  }
  ctx.collider.setHalfHeight(targetHeight / 2 - PHYSICS.PLAYER_RADIUS);

  // ── Dash / dodge — double-tap strafe ──
  if (s.dashCooldown > 0) s.dashCooldown -= dt;
  if (s.dashTimer > 0) {
    // Apply dash burst velocity each tick during the dash duration
    s.dashTimer -= dt;
    const burstFraction = PHYSICS.DASH_SPEED * dt / PHYSICS.DASH_DURATION;
    velocity.x += s.dashDirX * burstFraction;
    velocity.z += s.dashDirZ * burstFraction;
  }
  if (s.dashCooldown <= 0 && s.dashTimer <= 0 && !refs.isProne.current) {
    const now_dash = ctx.now;
    // Detect double-tap left
    if (input.left && !input.right) {
      if (s.lastLeftPress === 0) {
        s.lastLeftPress = now_dash;
      } else if ((now_dash - s.lastLeftPress) < PHYSICS.DASH_DOUBLE_TAP_WINDOW) {
        const sinYaw = Math.sin(refs.yaw.current);
        const cosYaw = Math.cos(refs.yaw.current);
        s.dashDirX = -cosYaw; // left = negative right vector
        s.dashDirZ = -sinYaw;
        s.dashTimer = PHYSICS.DASH_DURATION;
        s.dashCooldown = PHYSICS.DASH_COOLDOWN;
        s.lastLeftPress = 0;
        audioManager.play(SOUNDS.JUMP, 0.08);
        devLog.info('Physics', 'Dash left!');
      }
    } else {
      if (s.lastLeftPress > 0 && (now_dash - s.lastLeftPress) > PHYSICS.DASH_DOUBLE_TAP_WINDOW) {
        s.lastLeftPress = 0;
      }
    }
    // Detect double-tap right
    if (input.right && !input.left) {
      if (s.lastRightPress === 0) {
        s.lastRightPress = now_dash;
      } else if ((now_dash - s.lastRightPress) < PHYSICS.DASH_DOUBLE_TAP_WINDOW) {
        const sinYaw = Math.sin(refs.yaw.current);
        const cosYaw = Math.cos(refs.yaw.current);
        s.dashDirX = cosYaw; // right vector
        s.dashDirZ = sinYaw;
        s.dashTimer = PHYSICS.DASH_DURATION;
        s.dashCooldown = PHYSICS.DASH_COOLDOWN;
        s.lastRightPress = 0;
        audioManager.play(SOUNDS.JUMP, 0.08);
        devLog.info('Physics', 'Dash right!');
      }
    } else {
      if (s.lastRightPress > 0 && (now_dash - s.lastRightPress) > PHYSICS.DASH_DOUBLE_TAP_WINDOW) {
        s.lastRightPress = 0;
      }
    }
  }

  const isWallRunning = !refs.grounded.current && !combat.isGrappling && !refs.isProne.current && updateWallRun(
    s.wallRunState, velocity, refs.grounded.current,
    input.left, input.right, false, false,
    s.wallRunState.wallNormal[0], s.wallRunState.wallNormal[2], dt,
  );

  const canJump = refs.grounded.current || refs.coyoteTime.current > 0;
  const wantsJump = ctx.autoBhop ? input.jump : refs.jumpBufferTime.current > 0;
  const jumpBlocked = refs.isProne.current || (s.proneTransition > 0);

  if (isWallRunning && wantsJump) {
    const chainCount = wallJump(s.wallRunState, velocity);
    refs.jumpBufferTime.current = 0;
    store.recordJump();
    if (chainCount > 1) {
      audioManager.play(SOUNDS.WALL_RUN, 0.12 + chainCount * 0.03);
      devLog.info('Physics', `Wall-jump chain ×${chainCount} bonus=${chainCount * PHYSICS.WALL_JUMP_CHAIN_BONUS}`);
    }
  }

  const adsFactor = 1 - s.adsProgress * (1 - PHYSICS.ADS_SPEED_MULT);
  const _effectiveMaxSpeed = PHYSICS.GROUND_MAX_SPEED * speedMult * adsFactor;
  void _effectiveMaxSpeed; // used implicitly via speedMult in accel functions

  if (combat.isGrappling) {
    // handled in handleGrapple
  } else if (isWallRunning) {
    // handled by updateWallRun
  } else if (canJump && wantsJump && !jumpBlocked) {
    if (refs.isSliding.current) {
      const slideHopBoost = PHYSICS.CROUCH_SLIDE_HOP_BOOST;
      if (hSpeed > 0) {
        velocity.x += (velocity.x / hSpeed) * slideHopBoost;
        velocity.z += (velocity.z / hSpeed) * slideHopBoost;
      }
    }
    // Bhop timing window — perfect jump within window after landing adds speed boost
    if (s.lastLandingTime > 0 && (ctx.now - s.lastLandingTime) <= PHYSICS.BHOP_TIMING_WINDOW_MS && hSpeed > 0) {
      const bhopBoost = PHYSICS.BHOP_PERFECT_BOOST;
      velocity.x += (velocity.x / hSpeed) * bhopBoost;
      velocity.z += (velocity.z / hSpeed) * bhopBoost;
      s.bhopPerfect = true;
      audioManager.play(SOUNDS.SPEED_GATE, 0.06);
      devLog.info('Physics', `Bhop perfect! +${bhopBoost} u/s (window=${(ctx.now - s.lastLandingTime).toFixed(0)}ms)`);
    }
    s.lastLandingTime = 0;
    velocity.y = PHYSICS.JUMP_FORCE;
    refs.grounded.current = false;
    refs.coyoteTime.current = 0;
    refs.jumpBufferTime.current = 0;
    refs.isJumping.current = true;
    refs.jumpHoldTime.current = 0;
    refs.isSliding.current = false;
    s.slideTimer = 0;
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
      applyFriction(velocity, dt * (PHYSICS.PRONE_FRICTION / PHYSICS.GROUND_FRICTION), hasInput, wishDir);
      if (hasInput) {
        applyGroundAcceleration(velocity, wishDir, dt, speedMult);
        const pSpeed = getHorizontalSpeed(velocity);
        if (pSpeed > PHYSICS.PRONE_MAX_SPEED) {
          const pScale = PHYSICS.PRONE_MAX_SPEED / pSpeed;
          velocity.x *= pScale;
          velocity.z *= pScale;
        }
      }
    } else if (refs.isSliding.current) {
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

  if (refs.grounded.current && !s.wasGrounded && refs.isCrouching.current && !wantsCrouch && !refs.isProne.current) {
    refs.isCrouching.current = false;
    ctx.collider.setHalfHeight(PHYSICS.PLAYER_HEIGHT / 2 - PHYSICS.PLAYER_RADIUS);
  }

  const maxSpeed = PHYSICS.MAX_SPEED * speedMult;
  const totalSpeed = velocity.length();
  if (totalSpeed > maxSpeed) {
    velocity.multiplyScalar(maxSpeed / totalSpeed);
  }

  const displacement = totalSpeed * dt;
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

  if (Math.abs(totalDesiredX) > PHYSICS.SKIN_WIDTH && Math.abs(totalCorrectedX / totalDesiredX) < PHYSICS.VELOCITY_CORRECTION_RATIO) {
    velocity.x = 0;
  }
  if (Math.abs(totalDesiredZ) > PHYSICS.SKIN_WIDTH && Math.abs(totalCorrectedZ / totalDesiredZ) < PHYSICS.VELOCITY_CORRECTION_RATIO) {
    velocity.z = 0;
  }

  refs.grounded.current = ctx.controller.computedGrounded();

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
    if (Math.abs(n1.y) < PHYSICS.WALL_DOT_THRESHOLD) {
      const sinYaw = Math.sin(refs.yaw.current);
      const cosYaw = Math.cos(refs.yaw.current);
      const rightX = cosYaw;
      const rightZ = sinYaw;
      const wallDot = n1.x * rightX + n1.z * rightZ;
      if (wallDot > PHYSICS.WALL_DOT_THRESHOLD) {
        detectedWallLeft = true;
        detectedWallNormalX = n1.x;
        detectedWallNormalZ = n1.z;
      } else if (wallDot < -PHYSICS.WALL_DOT_THRESHOLD) {
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
      detectedWallNormalX, detectedWallNormalZ, 0,
    );
  }

  if (refs.grounded.current && !s.wasGrounded) {
    const fallSpeed = Math.abs(velocity.y);
    const landHSpeed = getHorizontalSpeed(velocity);
    if (fallSpeed > 200) audioManager.play(SOUNDS.LAND_HARD, 0.1);
    else audioManager.play(SOUNDS.LAND_SOFT, 0.1);
    if (fallSpeed > LANDING_DIP_MIN_FALL) {
      const intensity = Math.min((fallSpeed - LANDING_DIP_MIN_FALL) / 400, 1);
      s.landingDip = -LANDING_DIP_AMOUNT * intensity;
    }
    s.lastLandingTime = ctx.now;
    s.bhopPerfect = false;
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

  if (velocity.y > 0 && !refs.isJumping.current && s.mantleTimer <= 0 && _correctedMovement.y < _desiredTranslation.y * 0.5) {
    velocity.y = 0;
  }
  if (refs.grounded.current && velocity.y < 0) {
    velocity.y = 0;
  }

  return numCollisions;
}

export function handleMantle(ctx: TickContext): void {
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
    velocity.y < PHYSICS.MANTLE_MAX_ENTRY_VEL_Y
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
