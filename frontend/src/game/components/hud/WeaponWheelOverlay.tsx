/**
 * Game-specific weapon wheel overlay — maps combatStore weapon/ammo state into the engine WeaponWheel props.
 * Manages pointer lock: exits lock when wheel opens (so cursor is visible), re-requests on close.
 * Lock restoration uses user-gesture handlers (click for select/close, keyup for Q-release) to satisfy browser requirements.
 * Depends on: WeaponWheel (engine), combatStore, WEAPON_SLOTS
 * Used by: HudOverlay
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { WeaponWheel, type WeaponWheelSlot } from '@engine/hud/WeaponWheel';
import { useCombatStore } from '@game/stores/combatStore';
import type { WeaponType } from '../game/physics/types';
import { WEAPON_SLOTS } from '../game/physics/types';

const WEAPON_INFO: Record<(typeof WEAPON_SLOTS)[number], { label: string; short: string; color: string }> = {
  knife:   { label: 'Knife',    short: 'KNIFE', color: '#a0a0a0' },
  assault: { label: 'Assault',  short: 'AR',    color: '#60a5fa' },
  shotgun: { label: 'Shotgun',  short: 'SG',    color: '#f59e0b' },
  rocket:  { label: 'Rocket',   short: 'RL',    color: '#ef4444' },
  grenade: { label: 'Grenade',  short: 'GL',    color: '#22c55e' },
  sniper:  { label: 'Sniper',   short: 'SR',    color: '#a78bfa' },
  plasma:  { label: 'Plasma',   short: 'PG',    color: '#06b6d4' },
  pistol:  { label: 'Pistol',   short: 'PT',    color: '#94a3b8' },
} as const;

export function WeaponWheelOverlay() {
  const isOpen = useCombatStore((s) => s.weaponWheelOpen);
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const ammo = useCombatStore((s) => s.ammo);
  const lockTargetRef = useRef<Element | null>(null);

  /** Restore pointer lock — call from user-gesture context only. */
  const restoreLock = useCallback(() => {
    const target = lockTargetRef.current;
    if (target && target.isConnected) {
      target.requestPointerLock();
    }
    lockTargetRef.current = null;
  }, []);

  // Exit pointer lock when wheel opens
  useEffect(() => {
    if (isOpen) {
      lockTargetRef.current = document.pointerLockElement;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, [isOpen]);

  // Listen for Q-release (keyup) to restore lock when wheel closes via physics tick path.
  // This runs inside a real keyup event = valid user gesture for requestPointerLock.
  useEffect(() => {
    if (!isOpen && lockTargetRef.current) {
      const onKeyUp = () => {
        restoreLock();
        window.removeEventListener('keyup', onKeyUp);
      };
      window.addEventListener('keyup', onKeyUp, { once: true });
      return () => window.removeEventListener('keyup', onKeyUp);
    }
  }, [isOpen, restoreLock]);

  const slots: WeaponWheelSlot[] = useMemo(() =>
    WEAPON_SLOTS.map((w, i) => {
      const info = WEAPON_INFO[w];
      const a = ammo[w];
      return {
        id: w,
        label: info.label,
        short: info.short,
        color: info.color,
        keybind: `${i + 1}`,
        ammo: w === 'knife' ? null : { magazine: a.magazine, magSize: a.magSize, current: a.current, max: a.max },
        hasAmmo: w === 'knife' || (a.magazine ?? a.current) > 0 || a.current > 0,
      };
    }),
  [ammo]);

  // Click-based close/select: restore lock directly in the click handler (user gesture context)
  const handleSelect = useCallback((weaponId: string) => {
    const combat = useCombatStore.getState();
    combat.switchWeapon(weaponId as WeaponType);
    combat.closeWeaponWheel();
    restoreLock();
  }, [restoreLock]);

  const handleClose = useCallback(() => {
    useCombatStore.getState().closeWeaponWheel();
    restoreLock();
  }, [restoreLock]);

  return (
    <WeaponWheel
      open={isOpen}
      slots={slots}
      activeWeaponId={activeWeapon}
      onSelect={handleSelect}
      onClose={handleClose}
    />
  );
}
