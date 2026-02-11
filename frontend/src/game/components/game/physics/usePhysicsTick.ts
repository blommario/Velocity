/**
 * Main 128Hz physics tick orchestrator.
 * Sequences respawn, input, movement, combat, projectiles, and camera sub-systems.
 *
 * Depends on: ./state, ./respawnAndInput, ./grappleAndZones, ./combatTick, ./weaponFire, ./projectileTick, ./movementTick, ./cameraTick, @engine/physics/useMovement
 * Used by: PlayerController
 */
import { type Camera } from 'three';
import { PHYSICS } from './constants';
import { getWishDir } from '@engine/physics/useMovement';
import { useSettingsStore } from '@game/stores/settingsStore';
import { useGameStore } from '@game/stores/gameStore';
import { createScopeSwayState } from '@engine/physics/scopeSway';
import type { RecoilState } from '@engine/physics/recoil';
import { _playerPos, _fireDir } from './scratch';

// Re-export public API so consumers don't need to change imports
export type { PhysicsTickState, PhysicsTickRefs, TickContext } from './state';
export { createPhysicsTickState, registerPhysicsTickState, resetPhysicsTickState } from './state';

// Sub-system imports
import type { PhysicsTickState, PhysicsTickRefs } from './state';
import { handleRespawn, handleMouseLook, handleWeaponSwitch } from './respawnAndInput';
import { handleZoneEvents, handleGrapple } from './grappleAndZones';
import { handleCombatState } from './combatTick';
import { handleWeaponFire } from './weaponFire';
import { handleProjectiles } from './projectileTick';
import { handleMovement, handleMantle } from './movementTick';
import { handleCamera, handleHudAndReplay } from './cameraTick';

/** Execute a single 128Hz physics tick. */
export function physicsTick(
  refs: PhysicsTickRefs,
  camera: Camera,
  consumeMouseDelta: () => { dx: number; dy: number },
  rapierWorld: import('@dimforge/rapier3d-compat').World,
  state: PhysicsTickState,
  swayState: ReturnType<typeof createScopeSwayState>,
  recoilState: RecoilState,
): void {
  const rb = refs.rigidBody.current;
  const collider = refs.collider.current;
  const controller = refs.controller.current;
  if (!rb || !collider || !controller) return;

  const settings = useSettingsStore.getState();
  const gameState = useGameStore.getState();

  // V9: apply bullet-time slow-mo to physics dt
  const timeScale = gameState.timeScale;
  const scaledDt = PHYSICS.TICK_DELTA * timeScale;
  gameState.tickBulletTime();

  const ctx = {
    s: state,
    swayState,
    recoilState,
    refs,
    camera,
    rapierWorld,
    rb,
    collider,
    controller,
    input: refs.input.current,
    velocity: refs.velocity.current,
    dt: scaledDt,
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
