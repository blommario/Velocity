/**
 * Weapon fire handler -- processes fire input for all weapon types (rocket, grenade, sniper, assault, shotgun, knife, plasma) with spread, recoil, raycasts, and projectile spawning.
 * Depends on: combatStore, projectilePool, Rapier raycasts, engine recoil/seededRandom, AudioManager, HitMarker, wallSparks
 * Used by: PlayerController (physics tick)
 */
import { PHYSICS, RECOIL_PATTERNS, RECOIL_CONFIG } from './constants';
import { WEAPONS } from './types';
import type { TickContext } from './state';
import { _playerPos, _fireDir, _reusableRay } from './scratch';
import { useCombatStore } from '@game/stores/combatStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';
import { nextRandom } from '@engine/physics/seededRandom';
import { applyRecoilKick, getSpreadMultiplier } from '@engine/physics/recoil';
import { spawnProjectile } from './projectilePool';
import { pushHitMarker } from '../../hud/HitMarker';
import { spawnWallSparks } from '../effects/wallSparks';
import { IMPACT } from '@engine/effects/spawnImpactEffects';
import { devLog } from '@engine/stores/devLogStore';

export function handleWeaponFire(ctx: TickContext): void {
  const { refs, velocity, rapierWorld, rb, recoilState } = ctx;
  const combat = useCombatStore.getState();
  const weapon = combat.activeWeapon;
  const canFireNow = combat.fireCooldown <= 0 && combat.swapCooldown <= 0;
  const eyeOff = refs.isProne.current ? PHYSICS.PLAYER_EYE_OFFSET_PRONE
    : refs.isCrouching.current ? PHYSICS.PLAYER_EYE_OFFSET_CROUCH : PHYSICS.PLAYER_EYE_OFFSET;

  if (!ctx.input.fire || !canFireNow) return;

  const hasInput = ctx.input.forward || ctx.input.backward || ctx.input.left || ctx.input.right;
  const spreadMult = getSpreadMultiplier(
    hasInput, refs.grounded.current, refs.isCrouching.current,
    refs.isProne.current, ctx.s.adsProgress, RECOIL_CONFIG, PHYSICS.PRONE_SPREAD_MULT,
  );

  switch (weapon) {
    case WEAPONS.ROCKET: {
      if (combat.ammo.rocket.current > 0) {
        const sx = _playerPos.x + _fireDir.x;
        const sy = _playerPos.y + eyeOff + _fireDir.y;
        const sz = _playerPos.z + _fireDir.z;
        spawnProjectile(WEAPONS.ROCKET, sx, sy, sz,
          _fireDir.x * PHYSICS.ROCKET_SPEED, _fireDir.y * PHYSICS.ROCKET_SPEED, _fireDir.z * PHYSICS.ROCKET_SPEED);
        const newAmmo = combat.ammo.rocket.current - 1;
        useCombatStore.setState((s) => ({
          fireCooldown: PHYSICS.ROCKET_FIRE_COOLDOWN,
          ammo: { ...s.ammo, rocket: { ...s.ammo.rocket, current: newAmmo } },
        }));
        audioManager.play(SOUNDS.ROCKET_FIRE);
        const rk = applyRecoilKick(recoilState, RECOIL_PATTERNS.rocket,
          ctx.s.adsProgress, refs.isProne.current ? 1 : 0,
          RECOIL_CONFIG.adsRecoilMult, RECOIL_CONFIG.proneRecoilMult,
          nextRandom() * 2 - 1);
        refs.pitch.current += rk.dpitch;
        refs.yaw.current += rk.dyaw;
        devLog.info('Combat', `Rocket fired → ammo=${newAmmo}`);
      }
      break;
    }
    case WEAPONS.GRENADE: {
      if (combat.ammo.grenade.current > 0) {
        const sx = _playerPos.x + _fireDir.x * PHYSICS.GRENADE_SPAWN_OFFSET;
        const sy = _playerPos.y + eyeOff + _fireDir.y * PHYSICS.GRENADE_SPAWN_OFFSET;
        const sz = _playerPos.z + _fireDir.z * PHYSICS.GRENADE_SPAWN_OFFSET;
        spawnProjectile(WEAPONS.GRENADE, sx, sy, sz,
          _fireDir.x * PHYSICS.GRENADE_SPEED, _fireDir.y * PHYSICS.GRENADE_SPEED + PHYSICS.GRENADE_UPWARD_BOOST, _fireDir.z * PHYSICS.GRENADE_SPEED);
        const newAmmo = combat.ammo.grenade.current - 1;
        useCombatStore.setState((s) => ({
          fireCooldown: PHYSICS.GRENADE_FIRE_COOLDOWN,
          ammo: { ...s.ammo, grenade: { ...s.ammo.grenade, current: newAmmo } },
        }));
        audioManager.play(SOUNDS.GRENADE_THROW);
        const rk = applyRecoilKick(recoilState, RECOIL_PATTERNS.grenade,
          ctx.s.adsProgress, refs.isProne.current ? 1 : 0,
          RECOIL_CONFIG.adsRecoilMult, RECOIL_CONFIG.proneRecoilMult,
          nextRandom() * 2 - 1);
        refs.pitch.current += rk.dpitch;
        refs.yaw.current += rk.dyaw;
        devLog.info('Combat', `Grenade thrown → ammo=${newAmmo}`);
      }
      break;
    }
    case WEAPONS.SNIPER: {
      if (combat.fireHitscan(WEAPONS.SNIPER)) {
        _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
        _reusableRay.dir.x = _fireDir.x; _reusableRay.dir.y = _fireDir.y; _reusableRay.dir.z = _fireDir.z;
        const sniperHit = rapierWorld.castRayAndGetNormal(_reusableRay, PHYSICS.SNIPER_RANGE, true, undefined, undefined, undefined, rb);
        if (sniperHit) {
          const shx = _playerPos.x + _fireDir.x * sniperHit.timeOfImpact;
          const shy = (_playerPos.y + eyeOff) + _fireDir.y * sniperHit.timeOfImpact;
          const shz = _playerPos.z + _fireDir.z * sniperHit.timeOfImpact;
          spawnWallSparks(shx, shy, shz, sniperHit.normal.x, sniperHit.normal.y, sniperHit.normal.z, IMPACT.HEAVY);
          pushHitMarker();
        }
        velocity.x -= _fireDir.x * PHYSICS.SNIPER_KNOCKBACK;
        velocity.y -= _fireDir.y * PHYSICS.SNIPER_KNOCKBACK;
        velocity.z -= _fireDir.z * PHYSICS.SNIPER_KNOCKBACK;
        audioManager.play(SOUNDS.ROCKET_FIRE);
        const rk = applyRecoilKick(recoilState, RECOIL_PATTERNS.sniper,
          ctx.s.adsProgress, refs.isProne.current ? 1 : 0,
          RECOIL_CONFIG.adsRecoilMult, RECOIL_CONFIG.proneRecoilMult,
          nextRandom() * 2 - 1);
        refs.pitch.current += rk.dpitch;
        refs.yaw.current += rk.dyaw;
        devLog.info('Combat', `Sniper fired → ammo=${combat.ammo.sniper.current}`);
      }
      break;
    }
    case WEAPONS.ASSAULT: {
      if (combat.fireHitscan(WEAPONS.ASSAULT)) {
        const effectiveSpread = PHYSICS.ASSAULT_SPREAD * spreadMult;
        const spreadX = (nextRandom() - 0.5) * effectiveSpread * PHYSICS.HITSCAN_SPREAD_FACTOR;
        const spreadY = (nextRandom() - 0.5) * effectiveSpread * PHYSICS.HITSCAN_SPREAD_FACTOR;
        const aimX = _fireDir.x + spreadX;
        const aimY = _fireDir.y + spreadY;
        const aimZ = _fireDir.z;
        const aimLen = Math.sqrt(aimX * aimX + aimY * aimY + aimZ * aimZ);
        _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
        _reusableRay.dir.x = aimX / aimLen; _reusableRay.dir.y = aimY / aimLen; _reusableRay.dir.z = aimZ / aimLen;
        const arHit = rapierWorld.castRayAndGetNormal(_reusableRay, PHYSICS.ASSAULT_RANGE, true, undefined, undefined, undefined, rb);
        if (arHit) {
          const hx = _reusableRay.origin.x + _reusableRay.dir.x * arHit.timeOfImpact;
          const hy = _reusableRay.origin.y + _reusableRay.dir.y * arHit.timeOfImpact;
          const hz = _reusableRay.origin.z + _reusableRay.dir.z * arHit.timeOfImpact;
          spawnWallSparks(hx, hy, hz, arHit.normal.x, arHit.normal.y, arHit.normal.z, IMPACT.LIGHT);
          pushHitMarker();
        }
        velocity.x -= _fireDir.x * PHYSICS.ASSAULT_KNOCKBACK * ctx.dt;
        velocity.z -= _fireDir.z * PHYSICS.ASSAULT_KNOCKBACK * ctx.dt;
        audioManager.play(SOUNDS.LAND_SOFT, 0.05);
        const rk = applyRecoilKick(recoilState, RECOIL_PATTERNS.assault,
          ctx.s.adsProgress, refs.isProne.current ? 1 : 0,
          RECOIL_CONFIG.adsRecoilMult, RECOIL_CONFIG.proneRecoilMult,
          nextRandom() * 2 - 1);
        refs.pitch.current += rk.dpitch;
        refs.yaw.current += rk.dyaw;
      }
      break;
    }
    case WEAPONS.SHOTGUN: {
      if (combat.fireHitscan(WEAPONS.SHOTGUN)) {
        const effectiveSgSpread = PHYSICS.SHOTGUN_SPREAD * spreadMult;
        const physicalPellets = Math.min(PHYSICS.SHOTGUN_PELLETS, 4);
        for (let i = 0; i < physicalPellets; i++) {
          const sx = (nextRandom() - 0.5) * effectiveSgSpread * PHYSICS.HITSCAN_SPREAD_FACTOR;
          const sy = (nextRandom() - 0.5) * effectiveSgSpread * PHYSICS.HITSCAN_SPREAD_FACTOR;
          const px = _fireDir.x + sx;
          const py = _fireDir.y + sy;
          const pz = _fireDir.z;
          const pl = Math.sqrt(px * px + py * py + pz * pz);
          _reusableRay.origin.x = _playerPos.x; _reusableRay.origin.y = _playerPos.y + eyeOff; _reusableRay.origin.z = _playerPos.z;
          _reusableRay.dir.x = px / pl; _reusableRay.dir.y = py / pl; _reusableRay.dir.z = pz / pl;
          const hit = rapierWorld.castRayAndGetNormal(_reusableRay, PHYSICS.SHOTGUN_RANGE, true, undefined, undefined, undefined, rb);
          if (hit) {
            const hx = _reusableRay.origin.x + _reusableRay.dir.x * hit.timeOfImpact;
            const hy = _reusableRay.origin.y + _reusableRay.dir.y * hit.timeOfImpact;
            const hz = _reusableRay.origin.z + _reusableRay.dir.z * hit.timeOfImpact;
            spawnWallSparks(hx, hy, hz, hit.normal.x, hit.normal.y, hit.normal.z, IMPACT.MEDIUM);
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
        const rk = applyRecoilKick(recoilState, RECOIL_PATTERNS.shotgun,
          ctx.s.adsProgress, refs.isProne.current ? 1 : 0,
          RECOIL_CONFIG.adsRecoilMult, RECOIL_CONFIG.proneRecoilMult,
          nextRandom() * 2 - 1);
        refs.pitch.current += rk.dpitch;
        refs.yaw.current += rk.dyaw;
        devLog.info('Combat', `Shotgun fired → ammo=${combat.ammo.shotgun.current}`);
      }
      break;
    }
    case WEAPONS.KNIFE: {
      if (combat.fireKnife([_fireDir.x, _fireDir.y, _fireDir.z])) {
        audioManager.play(SOUNDS.GRAPPLE_ATTACH, 0.15);
        devLog.info('Combat', 'Knife lunge');
      }
      break;
    }
    case WEAPONS.PLASMA:
      break; // Handled in handleCombatState
  }
}
