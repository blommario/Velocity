/**
 * Camera tick -- handles wall-run tilt, landing dip, stance-based eye offset, and HUD/replay/dev-log updates at throttled rates.
 * Depends on: gameStore, combatStore, replayStore, devLogStore, PHYSICS constants
 * Used by: PlayerController (physics tick)
 */
import { PHYSICS } from './constants';
import type { TickContext } from './state';
import { _newPos } from './scratch';
import { getHorizontalSpeed } from '@engine/physics/useMovement';
import { getSlopeAngleDeg } from '@engine/physics/slopeDetection';
import { useGameStore, RUN_STATES, STANCES, type Stance } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { useReplayStore } from '@game/stores/replayStore';
import { activeCount } from './projectileTick';
import { devLog } from '@engine/stores/devLogStore';
import { encodePosition } from '@engine/networking';
import { useMultiplayerStore, MULTIPLAYER_STATUS } from '@game/stores/multiplayerStore';

const WALL_RUN_TILT = 0.15;
const TILT_LERP_SPEED = 10;
const LANDING_DIP_DECAY = 8;
const HUD_UPDATE_HZ = 30;
const HUD_UPDATE_INTERVAL = 1000 / HUD_UPDATE_HZ;
const DEV_LOG_INTERVAL = 2000;
const POSITION_SEND_INTERVAL = 50; // 20Hz — matches backend broadcast rate

export function handleCamera(ctx: TickContext): void {
  const { s, refs, camera, dt } = ctx;

  let targetTilt = 0;
  if (s.wallRunState.isWallRunning) {
    const sinYaw = Math.sin(refs.yaw.current);
    const cosYaw = Math.cos(refs.yaw.current);
    const wallDot = s.wallRunState.wallNormal[0] * cosYaw + s.wallRunState.wallNormal[2] * sinYaw;
    targetTilt = wallDot > 0 ? -WALL_RUN_TILT : WALL_RUN_TILT;
  }
  s.cameraTilt += (targetTilt - s.cameraTilt) * Math.min(TILT_LERP_SPEED * dt, 1);

  s.landingDip *= Math.max(0, 1 - LANDING_DIP_DECAY * dt);
  if (Math.abs(s.landingDip) < 0.001) s.landingDip = 0;

  const slideTiltTarget = refs.isSliding.current ? PHYSICS.CROUCH_SLIDE_TILT : 0;
  s.slidePitchOffset += (slideTiltTarget - s.slidePitchOffset) * Math.min(TILT_LERP_SPEED * dt, 1);
  if (Math.abs(s.slidePitchOffset) < 0.001) s.slidePitchOffset = 0;

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

export function handleHudAndReplay(ctx: TickContext, numCollisions: number): void {
  const { s, refs, velocity, now, speedMult, gravMult } = ctx;
  const store = useGameStore.getState();
  const combat = useCombatStore.getState();

  if (store.runState === RUN_STATES.RUNNING) {
    useReplayStore.getState().recordFrame(
      [_newPos.x, _newPos.y, _newPos.z],
      refs.yaw.current,
      refs.pitch.current,
    );
  }

  if (now - s.lastHudUpdate > HUD_UPDATE_INTERVAL) {
    s.lastHudUpdate = now;
    const finalHSpeed = getHorizontalSpeed(velocity);
    const stance: Stance = refs.isProne.current ? STANCES.PRONE
      : refs.isSliding.current ? STANCES.SLIDING
      : refs.isCrouching.current ? STANCES.CROUCHING
      : STANCES.STANDING;
    store.updateHud(finalHSpeed, [_newPos.x, _newPos.y, _newPos.z], refs.grounded.current, stance);
    if (store.timerRunning) store.tickTimer();
    store.tickScreenEffects(1 / HUD_UPDATE_HZ);
    useCombatStore.setState({ recoilBloom: ctx.recoilState.bloom });
  }

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

  // Multiplayer: send position at 20Hz when racing
  if (now - s.lastPositionSend > POSITION_SEND_INTERVAL) {
    const mp = useMultiplayerStore.getState();
    if (mp.multiplayerStatus === MULTIPLAYER_STATUS.RACING) {
      const t = mp.getTransport();
      if (t) {
        const hSpd = getHorizontalSpeed(velocity);
        const buf = encodePosition(
          _newPos.x, _newPos.y, _newPos.z,
          refs.yaw.current, refs.pitch.current,
          hSpd, store.currentCheckpoint,
        );
        t.sendUnreliable(buf);
        s.lastPositionSend = now;
      }
    }
  }
}
