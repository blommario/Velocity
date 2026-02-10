/**
 * Respawn, mouse look, and weapon switch handlers -- resets player state on respawn, applies sensitivity-adjusted mouse look, and processes weapon slot/scroll changes.
 * Depends on: gameStore, combatStore, engine recoil module, PHYSICS constants
 * Used by: PlayerController (physics tick)
 */
import { PHYSICS } from './constants';
import type { TickContext } from './state';
import { _newPos } from './scratch';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { resetRecoilState } from '@engine/physics/recoil';
import { devLog } from '@engine/stores/devLogStore';

export const MAX_PITCH = Math.PI / 2 - 0.01;
const RESPAWN_GRACE_TICKS = 16;

export function handleRespawn(
  ctx: TickContext,
  consumeMouseDelta: () => { dx: number; dy: number },
): boolean {
  const { s, refs, rb, velocity, camera } = ctx;
  const store = useGameStore.getState();
  const pos = rb.translation();

  if (pos.y < PHYSICS.VOID_Y || !Number.isFinite(pos.y)) {
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
    // Drain impulse inputs so they don't fire after grace ends
    input.weaponSlot = 0;
    input.scrollDelta = 0;
    return true;
  }

  return false;
}

export function handleMouseLook(ctx: TickContext, dx: number, dy: number): void {
  const { s, refs } = ctx;
  const effectiveSens = ctx.sensitivity * (1 - s.adsProgress * (1 - ctx.adsSensitivityMult));
  refs.yaw.current -= dx * effectiveSens;
  refs.pitch.current -= dy * effectiveSens;
  refs.pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, refs.pitch.current));
}

/** Hold threshold (seconds) — Q held longer than this opens the weapon wheel. */
const WEAPON_WHEEL_HOLD_THRESHOLD = 0.2;

/** Module-level state for weapon wheel hold detection. */
let _weaponWheelHoldStart = 0;
let _wasWeaponWheelPressed = false;

export function resetWeaponWheelState(): void {
  _weaponWheelHoldStart = 0;
  _wasWeaponWheelPressed = false;
}

export function handleWeaponSwitch(ctx: TickContext): void {
  const { s, input, recoilState, now } = ctx;
  const combat = useCombatStore.getState();
  const prevWeapon = combat.activeWeapon;

  // ── Weapon wheel / quick-switch (Q key) ──
  if (input.weaponWheel && !_wasWeaponWheelPressed) {
    // Key just pressed — record start time
    _weaponWheelHoldStart = now;
  }
  if (input.weaponWheel) {
    // Still held — open wheel after threshold
    const holdDuration = (now - _weaponWheelHoldStart) / 1000;
    if (holdDuration >= WEAPON_WHEEL_HOLD_THRESHOLD && !combat.weaponWheelOpen) {
      combat.openWeaponWheel();
    }
  }
  if (!input.weaponWheel && _wasWeaponWheelPressed) {
    // Key just released
    const holdDuration = (now - _weaponWheelHoldStart) / 1000;
    if (holdDuration < WEAPON_WHEEL_HOLD_THRESHOLD) {
      // Short tap → quick-switch to last weapon
      combat.quickSwitch();
    } else if (combat.weaponWheelOpen) {
      // Released after hold — close wheel (selection via click already handled in HUD)
      combat.closeWeaponWheel();
    }
  }
  _wasWeaponWheelPressed = input.weaponWheel;

  // ── Suppress slot/scroll input while weapon wheel is open ──
  if (combat.weaponWheelOpen) {
    input.weaponSlot = 0;
    input.scrollDelta = 0;
    return;
  }

  // ── Standard weapon switching (digit keys + scroll) ──
  if (input.weaponSlot > 0) {
    combat.switchWeaponBySlot(input.weaponSlot);
    input.weaponSlot = 0;
  }
  if (input.scrollDelta !== 0) {
    combat.scrollWeapon(input.scrollDelta > 0 ? 1 : -1);
    input.scrollDelta = 0;
  }
  if (useCombatStore.getState().activeWeapon !== prevWeapon) {
    s.adsProgress = 0;
    s.inspectProgress = 0;
    resetRecoilState(recoilState);
  }
}
