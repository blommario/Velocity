/**
 * Skeletal animation state machine — drives the arms AnimationMixer based
 * on combat/game state. Reads stores via getState() in useFrame (no subscriptions).
 *
 * Priority: DRAW > FIRE > RELOAD > INSPECT > IDLE
 *
 * Depends on: useAnimation (engine), combatStore, gameStore, viewmodelConfig, devLogStore
 * Used by: SkeletalViewmodel
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { UseAnimationResult } from '@engine/effects/useAnimation';
import { useCombatStore } from '@game/stores/combatStore';
import { useGameStore } from '@game/stores/gameStore';
import { SKELETAL_CLIPS, SKELETAL_OVERRIDES, WEAPON_MODELS } from '@game/components/game/viewmodelConfig';
import { RELOAD_CONFIG } from '@game/components/game/physics/constants';
import type { WeaponType } from '@game/components/game/physics/types';

/** Which procedural animations to suppress when skeletal clips handle them. */
export interface SuppressProcedural {
  reload: boolean;
  draw: boolean;
  inspect: boolean;
}

const ANIM_STATE = {
  NONE: 'none',
  IDLE: 'idle',
  FIRE: 'fire',
  RELOAD: 'reload',
  DRAW: 'draw',
  INSPECT: 'inspect',
} as const;

type AnimState = typeof ANIM_STATE[keyof typeof ANIM_STATE];

interface StateRefs {
  current: AnimState;
  prevWeapon: WeaponType;
  prevFireCooldown: number;
  drawTimer: number;
  fireTimer: number;
}

/** Keys in SkeletalAnimOverrides that hold clip name strings. */
type ClipOverrideKey = 'fireClip' | 'reloadClip' | 'drawClip' | 'inspectClip';

function getClipName(weapon: WeaponType, key: ClipOverrideKey, fallback: string): string {
  return SKELETAL_OVERRIDES[weapon]?.[key] ?? fallback;
}

export function useSkeletalAnimState(
  anim: UseAnimationResult,
): SuppressProcedural {
  const stateRef = useRef<StateRefs>({
    current: ANIM_STATE.NONE,
    prevWeapon: 'rocket',
    prevFireCooldown: 0,
    drawTimer: 0,
    fireTimer: 0,
  });

  const suppressRef = useRef<SuppressProcedural>({
    reload: false,
    draw: false,
    inspect: false,
  });

  // Check which clips exist
  const hasClip = (name: string): boolean => anim.clipNames.includes(name);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const combat = useCombatStore.getState();
    const speed = useGameStore.getState().speed;
    const s = stateRef.current;
    const weapon = combat.activeWeapon;
    const config = WEAPON_MODELS[weapon];

    // Only run for skeletal weapons
    if (!config.skeletal) return;

    // ── Detect weapon switch ──
    if (weapon !== s.prevWeapon) {
      s.prevWeapon = weapon;
      s.drawTimer = 0.3;
      s.current = ANIM_STATE.DRAW;
    }

    // ── Detect fire ──
    const justFired = combat.fireCooldown > 0 && s.prevFireCooldown === 0;
    s.prevFireCooldown = combat.fireCooldown;

    // ── Timers ──
    if (s.drawTimer > 0) s.drawTimer = Math.max(0, s.drawTimer - dt);
    if (s.fireTimer > 0) s.fireTimer = Math.max(0, s.fireTimer - dt);

    // ── State transitions (priority: draw > fire > reload > inspect > idle) ──
    let nextState: AnimState = ANIM_STATE.IDLE;

    if (s.drawTimer > 0) {
      nextState = ANIM_STATE.DRAW;
    } else if (justFired || s.fireTimer > 0) {
      if (justFired) s.fireTimer = 0.3;
      nextState = ANIM_STATE.FIRE;
    } else if (combat.isReloading) {
      nextState = ANIM_STATE.RELOAD;
    } else if (combat.inspectProgress > 0.01) {
      nextState = ANIM_STATE.INSPECT;
    } else {
      nextState = ANIM_STATE.IDLE;
    }

    // ── Play animations on state change ──
    if (nextState !== s.current) {
      const prevState = s.current;
      s.current = nextState;

      switch (nextState) {
        case ANIM_STATE.DRAW: {
          const holsterClip = SKELETAL_CLIPS.HOLSTER;
          const idleClip = SKELETAL_CLIPS.IDLE;
          if (hasClip(holsterClip) && hasClip(idleClip)) {
            anim.play(holsterClip, { loop: 'once', speed: 1.0 });
          } else if (hasClip(idleClip)) {
            anim.play(idleClip, { loop: 'repeat' });
          }
          break;
        }
        case ANIM_STATE.FIRE: {
          const fireClip = getClipName(weapon, 'fireClip', SKELETAL_CLIPS.FIRE);
          const idleClip = SKELETAL_CLIPS.IDLE;
          if (hasClip(fireClip)) {
            if (prevState === ANIM_STATE.IDLE && hasClip(idleClip)) {
              anim.crossFade(idleClip, fireClip, 0.05, { loop: 'once', speed: 1.5 });
            } else {
              anim.play(fireClip, { loop: 'once', speed: 1.5 });
            }
          }
          break;
        }
        case ANIM_STATE.RELOAD: {
          const reloadClip = getClipName(weapon, 'reloadClip', SKELETAL_CLIPS.RELOAD);
          const idleClip = SKELETAL_CLIPS.IDLE;
          if (hasClip(reloadClip)) {
            const reloadTime = RELOAD_CONFIG[weapon].reloadTime;
            const clipDuration = 0.9;
            const speed = clipDuration / reloadTime;
            if (prevState === ANIM_STATE.IDLE && hasClip(idleClip)) {
              anim.crossFade(idleClip, reloadClip, 0.15, { loop: 'once', speed });
            } else {
              anim.play(reloadClip, { loop: 'once', speed });
            }
          }
          break;
        }
        case ANIM_STATE.INSPECT: {
          const inspectClip = getClipName(weapon, 'inspectClip', SKELETAL_CLIPS.INSPECT);
          const idleClip = SKELETAL_CLIPS.IDLE;
          if (hasClip(inspectClip)) {
            if (prevState === ANIM_STATE.IDLE && hasClip(idleClip)) {
              anim.crossFade(idleClip, inspectClip, 0.2, { loop: 'once' });
            } else {
              anim.play(inspectClip, { loop: 'once' });
            }
          }
          break;
        }
        case ANIM_STATE.IDLE: {
          const idleClip = SKELETAL_CLIPS.IDLE;
          if (hasClip(idleClip)) {
            const prevClip = prevState === ANIM_STATE.FIRE ? getClipName(weapon, 'fireClip', SKELETAL_CLIPS.FIRE)
              : prevState === ANIM_STATE.RELOAD ? getClipName(weapon, 'reloadClip', SKELETAL_CLIPS.RELOAD)
              : prevState === ANIM_STATE.INSPECT ? getClipName(weapon, 'inspectClip', SKELETAL_CLIPS.INSPECT)
              : prevState === ANIM_STATE.DRAW ? SKELETAL_CLIPS.HOLSTER
              : null;
            if (prevClip && hasClip(prevClip)) {
              anim.crossFade(prevClip, idleClip, 0.2, { loop: 'repeat' });
            } else {
              anim.play(idleClip, { loop: 'repeat' });
            }
          }
          break;
        }
      }
    }

    // ── Suppress flags ──
    suppressRef.current.reload = hasClip(SKELETAL_CLIPS.RELOAD);
    suppressRef.current.draw = hasClip(SKELETAL_CLIPS.HOLSTER);
    suppressRef.current.inspect = hasClip(SKELETAL_CLIPS.INSPECT);

    void speed; // referenced for future walk clip support
  });

  return suppressRef.current;
}
