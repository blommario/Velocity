import { PHYSICS } from './constants';
import { WEAPONS } from './types';
import type { TickContext } from './state';
import { _playerPos, _reusableRay, _hitPos, _gPos } from './scratch';
import { applyExplosionKnockback } from '@engine/physics/useAdvancedMovement';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';
import { useExplosionStore } from '@engine/effects/ExplosionEffect';
import { spawnDecal } from '@engine/effects/DecalPool';
import { deactivateAt, updatePositions, getPool, getPoolSize, activeCount } from './projectilePool';
import { devLog } from '@engine/stores/devLogStore';

export { activeCount };

export function handleProjectiles(ctx: TickContext): void {
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
    if (p.posY < PHYSICS.PROJECTILE_VOID_Y || age > PHYSICS.PROJECTILE_MAX_AGE) {
      deactivateAt(i);
      continue;
    }

    if (p.type === WEAPONS.ROCKET) {
      const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY + p.velZ * p.velZ);
      if (speed < 0.01) { deactivateAt(i); continue; }

      const dirX = p.velX / speed;
      const dirY = p.velY / speed;
      const dirZ = p.velZ / speed;
      const travelDist = speed * dt;

      _reusableRay.origin.x = p.posX; _reusableRay.origin.y = p.posY; _reusableRay.origin.z = p.posZ;
      _reusableRay.dir.x = dirX; _reusableRay.dir.y = dirY; _reusableRay.dir.z = dirZ;

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
        useExplosionStore.getState().spawnExplosion(_hitPos, PHYSICS.ROCKET_EXPLOSION_COLOR, PHYSICS.ROCKET_EXPLOSION_SIZE);
        const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, hit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
        const nx = hitWithNormal?.normal.x ?? 0;
        const ny = hitWithNormal?.normal.y ?? 1;
        const nz = hitWithNormal?.normal.z ?? 0;
        spawnDecal(_hitPos[0], _hitPos[1], _hitPos[2], nx, ny, nz, PHYSICS.ROCKET_DECAL_RADIUS, PHYSICS.ROCKET_DECAL_LIFETIME, PHYSICS.ROCKET_DECAL_FADE_IN, PHYSICS.ROCKET_DECAL_FADE_OUT);
        deactivateAt(i);
        devLog.info('Combat', `Rocket exploded at [${_hitPos[0].toFixed(1)}, ${_hitPos[1].toFixed(1)}, ${_hitPos[2].toFixed(1)}] dmg=${damage.toFixed(0)}`);
      }
    } else if (p.type === WEAPONS.GRENADE) {
      if (age >= PHYSICS.GRENADE_FUSE_TIME) {
        _gPos[0] = p.posX; _gPos[1] = p.posY; _gPos[2] = p.posZ;
        const damage = applyExplosionKnockback(
          velocity, _playerPos, _gPos,
          PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, PHYSICS.GRENADE_DAMAGE * PHYSICS.GRENADE_SELF_DAMAGE_MULT,
          ctx.refs.grounded.current,
        );
        if (damage > 0) {
          ctx.refs.grounded.current = false;
          combat.takeDamage(damage);
          store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
        }
        audioManager.play(SOUNDS.GRENADE_EXPLODE);
        useExplosionStore.getState().spawnExplosion(_gPos, PHYSICS.GRENADE_EXPLOSION_COLOR, PHYSICS.GRENADE_EXPLOSION_SIZE);
        spawnDecal(_gPos[0], _gPos[1], _gPos[2], 0, 1, 0, PHYSICS.GRENADE_DECAL_RADIUS, PHYSICS.GRENADE_DECAL_LIFETIME, PHYSICS.GRENADE_DECAL_FADE_IN, PHYSICS.GRENADE_DECAL_FADE_OUT);
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

      const hit = rapierWorld.castRay(_reusableRay, travelDist + PHYSICS.GRENADE_RADIUS + 0.3, true, undefined, undefined, undefined, rb);

      if (hit) {
        const hitWithNormal = rapierWorld.castRayAndGetNormal(_reusableRay, hit.timeOfImpact + 0.01, true, undefined, undefined, undefined, rb);
        if (p.bounces >= 1) {
          _gPos[0] = p.posX; _gPos[1] = p.posY; _gPos[2] = p.posZ;
          const damage = applyExplosionKnockback(
            velocity, _playerPos, _gPos,
            PHYSICS.GRENADE_EXPLOSION_RADIUS, PHYSICS.GRENADE_KNOCKBACK_FORCE, PHYSICS.GRENADE_DAMAGE * PHYSICS.GRENADE_SELF_DAMAGE_MULT,
            ctx.refs.grounded.current,
          );
          if (damage > 0) {
            ctx.refs.grounded.current = false;
            combat.takeDamage(damage);
            store.triggerShake(Math.min(damage / PHYSICS.GRENADE_DAMAGE, 1) * 0.5);
          }
          audioManager.play(SOUNDS.GRENADE_EXPLODE);
          useExplosionStore.getState().spawnExplosion(_gPos, PHYSICS.GRENADE_EXPLOSION_COLOR, PHYSICS.GRENADE_EXPLOSION_SIZE);
          const gnx = hitWithNormal?.normal.x ?? 0;
          const gny = hitWithNormal?.normal.y ?? 1;
          const gnz = hitWithNormal?.normal.z ?? 0;
          spawnDecal(_gPos[0], _gPos[1], _gPos[2], gnx, gny, gnz, PHYSICS.GRENADE_DECAL_RADIUS, PHYSICS.GRENADE_DECAL_LIFETIME, PHYSICS.GRENADE_DECAL_FADE_IN, PHYSICS.GRENADE_DECAL_FADE_OUT);
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
