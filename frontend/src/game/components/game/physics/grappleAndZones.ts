/**
 * Grapple and zone event handler -- drains queued zone events (boost, launch, speed gate, ammo) and manages grapple hook attach/swing/release.
 * Depends on: combatStore, engine advancedMovement helpers, AudioManager, devLog
 * Used by: PlayerController (physics tick)
 */
import { PHYSICS } from './constants';
import type { TickContext } from './state';
import { _playerPos, _fireDir, _reusableRay } from './scratch';
import { applyGrappleSwing, applyBoostPad, applyLaunchPad, applySpeedGate } from '@engine/physics/useAdvancedMovement';
import { useCombatStore } from '@game/stores/combatStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';
import { devLog } from '@engine/stores/devLogStore';

export function handleZoneEvents(ctx: TickContext): void {
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

export function handleGrapple(ctx: TickContext): void {
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
    let bestDist: number = PHYSICS.GRAPPLE_MAX_DISTANCE;
    let bestPoint: [number, number, number] | null = null;

    for (const gp of grapplePoints) {
      const gpDx = gp[0] - _playerPos.x;
      const gpDy = gp[1] - _playerPos.y;
      const gpDz = gp[2] - _playerPos.z;
      const dist = Math.sqrt(gpDx * gpDx + gpDy * gpDy + gpDz * gpDz);
      if (dist > PHYSICS.GRAPPLE_MAX_DISTANCE || dist < PHYSICS.GRAPPLE_MIN_DISTANCE) continue;
      const dot = (gpDx / dist) * _fireDir.x + (gpDy / dist) * _fireDir.y + (gpDz / dist) * _fireDir.z;
      if (dot < PHYSICS.GRAPPLE_MIN_AIM_DOT) continue;
      if (dist < bestDist) { bestDist = dist as number; bestPoint = gp; }
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
        bestDist = grappleHit.timeOfImpact as number;
      }
    }

    if (bestPoint) {
      combat.startGrapple(bestPoint, bestDist);
      audioManager.play(SOUNDS.GRAPPLE_ATTACH);
      devLog.info('Combat', `Grapple attached → dist=${bestDist.toFixed(1)}`);
    }
  }
}
