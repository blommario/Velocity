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
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Vector3, Euler, Matrix4, Quaternion } from 'three';
import type { Group } from 'three';
import { ViewmodelLayer } from '@engine/rendering/ViewmodelLayer';
import { useViewmodelAnimation, type ViewmodelAnimationInput } from '@engine/rendering/useViewmodelAnimation';
import { MuzzleFlash, triggerMuzzleFlash } from '@engine/effects/MuzzleFlash';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { loadModel } from '@game/services/assetManager';
import { devLog } from '@engine/stores/devLogStore';
import { ADS_CONFIG } from './physics/constants';
import type { WeaponType } from './physics/types';

/** Anchor position and focal distance — all in camera-local space. */
const VM_ANCHOR = {
  X: 0.05,
  Y: -0.30,
  Z: -0.10,
  /** Shorter = snappier aim feel, longer = subtler. 8 is a good middle ground. */
  FOCAL_DIST: 8.0,
} as const;

/** Multipliers for game feel. */
const SWAY_INTENSITY = 2.0;
const TILT_INTENSITY = 0.8;

const WEAPON_COLORS: Record<WeaponType, string> = {
  rocket: '#884422',
  grenade: '#446622',
  sniper: '#334466',
  assault: '#555555',
  shotgun: '#664422',
  knife: '#888888',
  plasma: '#224466',
} as const;

const MUZZLE_COLORS: Record<WeaponType, [number, number, number]> = {
  rocket: [1.0, 0.5, 0.1],
  grenade: [0.5, 1.0, 0.2],
  sniper: [0.8, 0.8, 1.0],
  assault: [1.0, 0.7, 0.2],
  shotgun: [1.0, 0.6, 0.1],
  knife: [0, 0, 0],
  plasma: [0.3, 0.6, 1.0],
} as const;

const RIFLE_MODEL = {
  PATH: 'weapons/rifle.glb',
  SCALE: 0.065,
  ROTATION_Y: Math.PI / 2,
  OFFSET_X: 0.00,
  OFFSET_Y: -0.02,
  OFFSET_Z: -0.35,
} as const;

const knifeGeometry = new BoxGeometry(0.02, 0.02, 0.3);

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

function useRifleModel(): Group | null {
  const [model, setModel] = useState<Group | null>(null);
  useEffect(() => {
    let cancelled = false;
    devLog.info('Viewmodel', 'Loading rifle model...');
    loadModel(RIFLE_MODEL.PATH).then((scene) => {
      if (cancelled) return;
      devLog.info('Viewmodel', `Rifle loaded: ${scene.children.length} children`);
      scene.scale.setScalar(RIFLE_MODEL.SCALE);
      scene.rotation.y = RIFLE_MODEL.ROTATION_Y;
      scene.position.set(RIFLE_MODEL.OFFSET_X, RIFLE_MODEL.OFFSET_Y, RIFLE_MODEL.OFFSET_Z);
      setModel(scene);
    }).catch((err) => {
      devLog.error('Viewmodel', `Rifle model load failed: ${err}`);
    });
    return () => { cancelled = true; };
  }, []);
  return model;
}

function ViewmodelContent() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseDeltaRef = useRef<[number, number]>([0, 0]);

  // Capture mouse movement for weapon look-sway and tilt
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseDeltaRef.current[0] += e.movementX;
      mouseDeltaRef.current[1] += e.movementY;
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => { document.removeEventListener('mousemove', handleMouseMove); };
  }, []);

  const rifleModel = useRifleModel();
  const stateRef = useRef<ViewmodelState>({
    prevWeapon: 'rocket',
    drawTimer: 0,
    prevFireCooldown: 0,
  });

  const getInput = useCallback((): ViewmodelAnimationInput => {
    const speed = useGameStore.getState().speed;
    const grounded = useGameStore.getState().grounded;
    const combat = useCombatStore.getState();
    const state = stateRef.current;

    if (combat.activeWeapon !== state.prevWeapon) {
      state.prevWeapon = combat.activeWeapon;
      state.drawTimer = 0.3;
    }

    const isFiring = combat.fireCooldown > 0 && state.prevFireCooldown === 0;

    const [mx, my] = mouseDeltaRef.current;
    mouseDeltaRef.current[0] = 0;
    mouseDeltaRef.current[1] = 0;

    return {
      speed,
      grounded,
      isFiring,
      isDrawing: state.drawTimer > 0,
      mouseDeltaX: mx,
      mouseDeltaY: my,
      adsProgress: combat.adsProgress,
    };
  }, []);

  const anim = useViewmodelAnimation(getInput);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const vmState = stateRef.current;
    const dt = Math.min(delta, 0.05);

    if (vmState.drawTimer > 0) {
      vmState.drawTimer = Math.max(0, vmState.drawTimer - dt);
    }

    // ── Point A: stock anchor in camera-local space (lerped toward ADS position) ──
    const combat = useCombatStore.getState();
    const p = combat.adsProgress;
    const adsConf = ADS_CONFIG[combat.activeWeapon];
    const swayScale = SWAY_INTENSITY * (1 - p * 0.7); // reduce sway at full ADS
    _pointA.set(
      VM_ANCHOR.X + (adsConf.anchorX - VM_ANCHOR.X) * p + anim.posX * swayScale,
      VM_ANCHOR.Y + (adsConf.anchorY - VM_ANCHOR.Y) * p + anim.posY * swayScale,
      VM_ANCHOR.Z + (adsConf.anchorZ - VM_ANCHOR.Z) * p + anim.posZ,
    );

    // ── Point B: crosshair, always dead center ──
    _pointB.set(0, 0, -VM_ANCHOR.FOCAL_DIST);

    // ── Position at stock ──
    group.position.copy(_pointA);

    // ── Rotate barrel from A toward B ──
    _lookMatrix.lookAt(_pointA, _pointB, _up.set(0, 1, 0));
    _aimQuat.setFromRotationMatrix(_lookMatrix);
    group.quaternion.copy(_aimQuat);

    // ── Banking/tilt: weapon rolls when turning ──
    if (anim.rotZ !== 0) {
      _tempEuler.set(0, 0, anim.rotZ * TILT_INTENSITY);
      _tiltQuat.setFromEuler(_tempEuler);
      group.quaternion.multiply(_tiltQuat);
    }

    // ── Recoil pitch ──
    if (anim.rotX !== 0) {
      _tempEuler.set(anim.rotX, 0, 0);
      _recoilQuat.setFromEuler(_tempEuler);
      group.quaternion.multiply(_recoilQuat);
    }

    // ── Muzzle flash (reuses `combat` from ADS block above) ──
    const justFired = combat.fireCooldown > 0 && vmState.prevFireCooldown === 0;
    if (justFired && combat.activeWeapon !== 'knife') {
      const [r, g, b] = MUZZLE_COLORS[combat.activeWeapon];
      _muzzleOffset.set(0, 0.02, RIFLE_MODEL.OFFSET_Z - 0.45);
      _muzzleOffset.applyQuaternion(group.quaternion);
      triggerMuzzleFlash(
        group.position.x + _muzzleOffset.x,
        group.position.y + _muzzleOffset.y,
        group.position.z + _muzzleOffset.z,
        r, g, b,
      );
    }

    vmState.prevFireCooldown = combat.fireCooldown;
  });

  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const color = WEAPON_COLORS[activeWeapon];
  const isKnife = activeWeapon === 'knife';

  return (
    <group ref={groupRef}>
      {isKnife ? (
        <mesh geometry={knifeGeometry} position={[0, -0.1, -0.2]}>
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        </mesh>
      ) : (
        <group>
          {rifleModel ? (
            <primitive object={rifleModel} />
          ) : (
            <mesh position={[0, 0, RIFLE_MODEL.OFFSET_Z]}>
              <boxGeometry args={[0.06, 0.05, 0.35]} />
              <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

export function Viewmodel() {
  return (
    <ViewmodelLayer>
      <ViewmodelContent />
      <MuzzleFlash />
    </ViewmodelLayer>
  );
}
