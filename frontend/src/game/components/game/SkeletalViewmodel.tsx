/**
 * Skeletal first-person viewmodel — arms model with skeleton-driven animations
 * and weapon attached to a bone socket. Procedural sway/bob/tilt applied on top.
 *
 * Depends on: useSkeletalViewmodel, useSkeletalAnimState, useBoneSocket,
 *   useViewmodelAnimation, useAnimation, combatStore, gameStore, viewmodelConfig
 * Used by: Viewmodel (conditional branch when weapon config has skeletal=true)
 */
import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Euler, Matrix4, Quaternion } from 'three';
import type { Group, Bone } from 'three';
import { useViewmodelAnimation, type ViewmodelAnimationInput } from '@engine/rendering/useViewmodelAnimation';
import { useAnimation } from '@engine/effects/useAnimation';
import { useBoneSocket } from '@engine/effects/useBoneSocket';
import { triggerMuzzleFlash } from '@engine/effects/MuzzleFlash';
import { useSkeletalViewmodel } from '@game/hooks/useSkeletalViewmodel';
import { useSkeletalAnimState } from '@game/hooks/useSkeletalAnimState';
import { useCombatStore } from '@game/stores/combatStore';
import { useGameStore } from '@game/stores/gameStore';
import { ADS_CONFIG } from './physics/constants';
import {
  VM_ANCHOR, SWAY_INTENSITY, TILT_INTENSITY,
  MUZZLE_COLORS, WEAPON_MODELS, ARMS_MODEL,
} from './viewmodelConfig';

// Pre-allocated objects (zero GC)
const _muzzleWorld = new Vector3();
const _pointA = new Vector3();
const _pointB = new Vector3();
const _aimQuat = new Quaternion();
const _tiltQuat = new Quaternion();
const _recoilQuat = new Quaternion();
const _lookMatrix = new Matrix4();
const _up = new Vector3(0, 1, 0);
const _tempEuler = new Euler();

export function SkeletalViewmodelContent() {
  const groupRef = useRef<Group>(null);
  const mouseDeltaRef = useRef<[number, number]>([0, 0]);
  const prevFireRef = useRef(0);
  const muzzleBoneRef = useRef<Bone | null>(null);

  // Mouse tracking
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseDeltaRef.current[0] += e.movementX;
      mouseDeltaRef.current[1] += e.movementY;
    };
    document.addEventListener('mousemove', handler);
    return () => { document.removeEventListener('mousemove', handler); };
  }, []);

  // Load arms + weapon models
  const { armsScene, armsClips, weaponScene } = useSkeletalViewmodel();

  // Animation mixer for arms skeleton
  const animResult = useAnimation({ root: armsScene, clips: armsClips });

  // Skeletal animation state machine (reads combat state, drives clips)
  const suppress = useSkeletalAnimState(animResult);

  // Weapon bone socket attachment
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const weaponConfig = WEAPON_MODELS[activeWeapon];

  const socketOffset = useMemo(() => weaponConfig.socketOffsetX !== undefined
    ? { x: weaponConfig.socketOffsetX ?? 0, y: weaponConfig.socketOffsetY ?? 0, z: weaponConfig.socketOffsetZ ?? 0 }
    : undefined, [weaponConfig.socketOffsetX, weaponConfig.socketOffsetY, weaponConfig.socketOffsetZ]);

  const socketRotation = useMemo(() => weaponConfig.socketRotX !== undefined
    ? { x: weaponConfig.socketRotX ?? 0, y: weaponConfig.socketRotY ?? 0, z: weaponConfig.socketRotZ ?? 0 }
    : undefined, [weaponConfig.socketRotX, weaponConfig.socketRotY, weaponConfig.socketRotZ]);

  useBoneSocket({
    root: armsScene,
    boneName: ARMS_MODEL.BONE_NAME,
    attachment: weaponScene,
    offset: socketOffset,
    rotation: socketRotation,
  });

  // Find muzzle bone in weapon scene
  useEffect(() => {
    muzzleBoneRef.current = null;
    if (!weaponScene || !weaponConfig.muzzleBoneName) return;
    weaponScene.traverse((child) => {
      if (child.name === weaponConfig.muzzleBoneName && (child as Bone).isBone) {
        muzzleBoneRef.current = child as Bone;
      }
    });
  }, [weaponScene, weaponConfig.muzzleBoneName]);

  // Procedural animation input (sway, bob, tilt — suppress skeletal-handled anims)
  const getInput = useCallback((): ViewmodelAnimationInput => {
    const speed = useGameStore.getState().speed;
    const grounded = useGameStore.getState().isGrounded;
    const combat = useCombatStore.getState();
    const isFiring = combat.fireCooldown > 0 && prevFireRef.current === 0;
    const [mx, my] = mouseDeltaRef.current;
    mouseDeltaRef.current[0] = 0;
    mouseDeltaRef.current[1] = 0;
    return {
      speed,
      grounded,
      isFiring,
      isDrawing: suppress.draw ? false : combat.swapCooldown > 0,
      mouseDeltaX: mx,
      mouseDeltaY: my,
      adsProgress: combat.adsProgress,
      inspectProgress: suppress.inspect ? 0 : combat.inspectProgress,
      reloadProgress: suppress.reload ? 0 : (combat.isReloading ? combat.reloadProgress : 0),
    };
  }, [suppress]);

  const anim = useViewmodelAnimation(getInput);

  // Per-frame: apply procedural offsets to group + muzzle flash
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const combat = useCombatStore.getState();
    const p = combat.adsProgress;
    const adsConf = ADS_CONFIG[combat.activeWeapon];
    const swayScale = SWAY_INTENSITY * (1 - p * 0.7);

    _pointA.set(
      VM_ANCHOR.X + (adsConf.anchorX - VM_ANCHOR.X) * p + anim.posX * swayScale,
      VM_ANCHOR.Y + (adsConf.anchorY - VM_ANCHOR.Y) * p + anim.posY * swayScale,
      VM_ANCHOR.Z + (adsConf.anchorZ - VM_ANCHOR.Z) * p + anim.posZ,
    );
    _pointB.set(0, 0, -VM_ANCHOR.FOCAL_DIST);
    group.position.copy(_pointA);
    _lookMatrix.lookAt(_pointA, _pointB, _up.set(0, 1, 0));
    _aimQuat.setFromRotationMatrix(_lookMatrix);
    group.quaternion.copy(_aimQuat);

    if (anim.rotZ !== 0) { _tempEuler.set(0, 0, anim.rotZ * TILT_INTENSITY); _tiltQuat.setFromEuler(_tempEuler); group.quaternion.multiply(_tiltQuat); }
    if (anim.rotX !== 0) { _tempEuler.set(anim.rotX, 0, 0); _recoilQuat.setFromEuler(_tempEuler); group.quaternion.multiply(_recoilQuat); }
    if (anim.rotY !== 0) { _tempEuler.set(0, anim.rotY, 0); _recoilQuat.setFromEuler(_tempEuler); group.quaternion.multiply(_recoilQuat); }

    // Muzzle flash
    const justFired = combat.fireCooldown > 0 && prevFireRef.current === 0;
    if (justFired && combat.activeWeapon !== 'knife') {
      const [r, g, b] = MUZZLE_COLORS[combat.activeWeapon];
      if (muzzleBoneRef.current) {
        muzzleBoneRef.current.getWorldPosition(_muzzleWorld);
        group.worldToLocal(_muzzleWorld);
        triggerMuzzleFlash(group.position.x + _muzzleWorld.x, group.position.y + _muzzleWorld.y, group.position.z + _muzzleWorld.z, r, g, b);
      } else {
        _muzzleWorld.set(0, 0.02, WEAPON_MODELS[combat.activeWeapon].offsetZ - 0.45);
        _muzzleWorld.applyQuaternion(group.quaternion);
        triggerMuzzleFlash(group.position.x + _muzzleWorld.x, group.position.y + _muzzleWorld.y, group.position.z + _muzzleWorld.z, r, g, b);
      }
    }
    prevFireRef.current = combat.fireCooldown;
  });

  if (!armsScene) return null;

  return (
    <group ref={groupRef}>
      <primitive object={armsScene} />
    </group>
  );
}
