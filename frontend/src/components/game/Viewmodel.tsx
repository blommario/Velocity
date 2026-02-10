/**
 * First-person weapon viewmodel.
 *
 * Updated logic: Weapon is anchored at the stock (Point A) and looks at crosshair (Point B).
 *
 * Pivot principle:
 * - Point A (anchor/stock) sits at bottom-center of viewport
 * - The 3D model is offset forward (-Z) inside the group so group origin = stock
 * - Point B (crosshair) is at (0, 0, -FOCAL_DIST) on camera forward axis
 * - Each frame the group is rotated so barrel always points from A toward B
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Vector3, Euler, Matrix4, Quaternion } from 'three';
import type { Group } from 'three';
import { ViewmodelLayer, getViewmodelScene } from '../../engine/rendering/ViewmodelLayer';
import { useViewmodelAnimation, type ViewmodelAnimationInput } from '../../engine/rendering/useViewmodelAnimation';
import { MuzzleFlash, triggerMuzzleFlash } from '../../engine/effects/MuzzleFlash';
import { useGameStore } from '../../stores/gameStore';
import { useCombatStore } from '../../stores/combatStore';
import { loadModel } from '../../services/assetManager';
import { devLog } from '../../engine/stores/devLogStore';
import type { WeaponType } from './physics/types';

/**
 * Anchor-based weapon positioning.
 *
 * Point A = Stock position (Pivot Point), bottom-center of viewport.
 * Point B = Crosshair focal point on camera forward axis.
 */
const VM_ANCHOR = {
  X: 0.0,
  Y: -0.35,
  Z: 0.1,
  /** Distance to the virtual crosshair point (Point B). */
  FOCAL_DIST: 10,
} as const;

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
  knife: [0, 0, 0], // no flash
  plasma: [0.3, 0.6, 1.0],
} as const;

// Rifle 3D model transform — rotateY(PI/2) maps barrel from +X to -Z (forward)
const RIFLE_MODEL = {
  PATH: 'weapons/rifle.glb',
  SCALE: 0.045,
  // Rotate 90° — barrel points forward (-Z)
  ROTATION_Y: Math.PI / 2,
  // Offset inside the group — push model forward so group origin = stock (rear).
  OFFSET_X: 0.00,
  OFFSET_Y: 0.00,
  OFFSET_Z: -0.30,
} as const;

// Pre-allocated geometries for fallback/knife
const knifeGeometry = new BoxGeometry(0.02, 0.02, 0.3);

// Pre-allocated vectors (zero GC)
const _muzzleOffset = new Vector3();
const _muzzleEuler = new Euler();
const _pointA = new Vector3();
const _pointB = new Vector3();
const _aimQuat = new Quaternion();
const _recoilQuat = new Quaternion();
const _lookMatrix = new Matrix4();
const _up = new Vector3(0, 1, 0);

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

  // Capture mouse movement for weapon look-sway
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

    // Detect weapon switch -> trigger draw
    const currentWeapon = combat.activeWeapon;
    if (currentWeapon !== state.prevWeapon) {
      state.prevWeapon = currentWeapon;
      state.drawTimer = 0.3; // 300ms draw animation
    }

    // Detect fire event (cooldown transitions from 0 to >0)
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
    };
  }, []);

  const anim = useViewmodelAnimation(getInput);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const vmRef = getViewmodelScene();
    if (!vmRef) return;

    const vmState = stateRef.current;
    const dt = Math.min(delta, 0.05);

    if (vmState.drawTimer > 0) {
      vmState.drawTimer = Math.max(0, vmState.drawTimer - dt);
    }

    // The viewmodel camera copies main camera's quaternion each frame
    // (in ViewmodelLayer). Weapon children live in scene worldspace, so we
    // must transform camera-local offsets into scene worldspace via the
    // camera's quaternion.
    const camQ = vmRef.camera.quaternion;

    // ── Point A: anchor (stock) in camera-local, then transformed to world ──
    _pointA.set(
      VM_ANCHOR.X + anim.posX,
      VM_ANCHOR.Y + anim.posY,
      VM_ANCHOR.Z + anim.posZ,
    ).applyQuaternion(camQ);

    // ── Point B: crosshair focal point in camera-local, then to world ──
    _pointB.set(0, 0, -VM_ANCHOR.FOCAL_DIST).applyQuaternion(camQ);

    // ── Position group at Point A (world space) ──
    group.position.copy(_pointA);

    // ── Rotate group so barrel (-Z) points from A toward B (world space) ──
    _lookMatrix.lookAt(_pointA, _pointB, _up.set(0, 1, 0).applyQuaternion(camQ));
    _aimQuat.setFromRotationMatrix(_lookMatrix);
    group.quaternion.copy(_aimQuat);

    // ── Apply recoil pitch in camera-local, then transform to world ──
    if (anim.rotX !== 0) {
      _muzzleEuler.set(anim.rotX, 0, 0);
      _recoilQuat.setFromEuler(_muzzleEuler);
      // Pre-multiply: rotate in camera-local frame by conjugating with camQ
      // world = camQ * local * camQ^-1, then multiply onto aim
      _recoilQuat.premultiply(camQ);
      _aimQuat.copy(camQ).invert();
      _recoilQuat.multiply(_aimQuat);
      group.quaternion.multiply(_recoilQuat);
    }

    // ── Muzzle flash ──
    const combat = useCombatStore.getState();
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
