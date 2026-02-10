/**
 * First-person weapon viewmodel.
 *
 * Pivot principle (all in camera-local space):
 * - Point A (anchor/stock) sits at bottom-center of viewport
 * - The 3D model is offset forward (-Z) inside the group so group origin = stock
 * - Point B (crosshair) is at (0, 0, -FOCAL_DIST) on camera forward axis
 * - Each frame the group is rotated so barrel always points from A toward B
 * - Banking/tilt (rotZ) gives the weapon weight when turning
 *
 * ViewmodelLayer handles camera rotation sync — we work purely in local space.
 *
 * Depends on: ViewmodelLayer, useViewmodelAnimation, MuzzleFlash, combatStore, gameStore, viewmodelConfig
 * Used by: GameCanvas
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Euler, Matrix4, Quaternion } from 'three';
import type { Group } from 'three';
import { ViewmodelLayer } from '@engine/rendering/ViewmodelLayer';
import { useViewmodelAnimation, type ViewmodelAnimationInput } from '@engine/rendering/useViewmodelAnimation';
import { MuzzleFlash, triggerMuzzleFlash } from '@engine/effects/MuzzleFlash';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { loadModel } from '@game/services/assetManager';
import { devLog } from '@engine/stores/devLogStore';
import { ADS_CONFIG } from './physics/constants';
import {
  VM_ANCHOR, SWAY_INTENSITY, TILT_INTENSITY,
  WEAPON_COLORS, MUZZLE_COLORS, WEAPON_MODELS,
  knifeGeometry,
  type WeaponModelConfig,
} from './viewmodelConfig';
import type { WeaponType } from './physics/types';

// Pre-allocated objects (zero GC)
const _muzzleOffset = new Vector3();
const _pointA = new Vector3();
const _pointB = new Vector3();
const _aimQuat = new Quaternion();
const _tiltQuat = new Quaternion();
const _recoilQuat = new Quaternion();
const _lookMatrix = new Matrix4();
const _up = new Vector3(0, 1, 0);
const _tempEuler = new Euler();

interface ViewmodelState {
  prevWeapon: WeaponType;
  drawTimer: number;
  prevFireCooldown: number;
}

function useWeaponModel(config: WeaponModelConfig): Group | null {
  const [model, setModel] = useState<Group | null>(null);
  useEffect(() => {
    if (config.path === null) { setModel(null); return; }
    let cancelled = false;
    const modelPath = config.path;
    devLog.info('Viewmodel', `Loading weapon model: ${modelPath}...`);
    loadModel(modelPath).then((scene) => {
      if (cancelled) return;
      devLog.info('Viewmodel', `Weapon loaded: ${scene.children.length} children`);
      scene.scale.setScalar(config.scale);
      scene.rotation.y = config.rotationY;
      scene.position.set(config.offsetX, config.offsetY, config.offsetZ);
      setModel(scene);
    }).catch((err) => { devLog.error('Viewmodel', `Weapon model load failed: ${err}`); });
    return () => { cancelled = true; };
  }, [config.path, config.scale, config.rotationY, config.offsetX, config.offsetY, config.offsetZ]);
  return model;
}

function ViewmodelContent() {
  const groupRef = useRef<any>(null);
  const mouseDeltaRef = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseDeltaRef.current[0] += e.movementX;
      mouseDeltaRef.current[1] += e.movementY;
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => { document.removeEventListener('mousemove', handleMouseMove); };
  }, []);

  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const weaponConfig = WEAPON_MODELS[activeWeapon];
  const weaponModel = useWeaponModel(weaponConfig);

  const stateRef = useRef<ViewmodelState>({ prevWeapon: 'rocket', drawTimer: 0, prevFireCooldown: 0 });

  const getInput = useCallback((): ViewmodelAnimationInput => {
    const speed = useGameStore.getState().speed;
    const grounded = useGameStore.getState().isGrounded;
    const combat = useCombatStore.getState();
    const state = stateRef.current;
    if (combat.activeWeapon !== state.prevWeapon) { state.prevWeapon = combat.activeWeapon; state.drawTimer = 0.3; }
    const isFiring = combat.fireCooldown > 0 && state.prevFireCooldown === 0;
    const [mx, my] = mouseDeltaRef.current;
    mouseDeltaRef.current[0] = 0;
    mouseDeltaRef.current[1] = 0;
    return { speed, grounded, isFiring, isDrawing: state.drawTimer > 0, mouseDeltaX: mx, mouseDeltaY: my, adsProgress: combat.adsProgress, inspectProgress: combat.inspectProgress, reloadProgress: combat.isReloading ? combat.reloadProgress : 0 };
  }, []);

  const anim = useViewmodelAnimation(getInput);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const vmState = stateRef.current;
    const dt = Math.min(delta, 0.05);
    if (vmState.drawTimer > 0) vmState.drawTimer = Math.max(0, vmState.drawTimer - dt);

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

    const justFired = combat.fireCooldown > 0 && vmState.prevFireCooldown === 0;
    if (justFired && combat.activeWeapon !== 'knife') {
      const [r, g, b] = MUZZLE_COLORS[combat.activeWeapon];
      _muzzleOffset.set(0, 0.02, WEAPON_MODELS[combat.activeWeapon].offsetZ - 0.45);
      _muzzleOffset.applyQuaternion(group.quaternion);
      triggerMuzzleFlash(group.position.x + _muzzleOffset.x, group.position.y + _muzzleOffset.y, group.position.z + _muzzleOffset.z, r, g, b);
    }
    vmState.prevFireCooldown = combat.fireCooldown;
  });

  const color = WEAPON_COLORS[activeWeapon];
  const isKnife = activeWeapon === 'knife';

  return (
    <group ref={groupRef}>
      {isKnife ? (
        <mesh geometry={knifeGeometry} position={[0, -0.1, -0.2]}>
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        </mesh>
      ) : weaponModel ? (
        <primitive object={weaponModel} />
      ) : (
        <mesh position={[0, 0, weaponConfig.offsetZ]}>
          <boxGeometry args={[0.06, 0.05, 0.35]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}

export function Viewmodel() {
  const inspectProgress = useCombatStore((s) => s.inspectProgress);
  const lightBoost = 1.0 + inspectProgress * 0.6;
  return (
    <ViewmodelLayer lightBoost={lightBoost}>
      <ViewmodelContent />
      <MuzzleFlash />
    </ViewmodelLayer>
  );
}
