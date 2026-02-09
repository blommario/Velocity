/**
 * First-person weapon viewmodel.
 *
 * Renders a procedurally animated weapon shape in the ViewmodelLayer
 * (separate scene with its own camera). Reads from game stores to drive
 * animation state (velocity, firing, weapon switching).
 *
 * MuzzleFlash is rendered inside the ViewmodelLayer so flash coordinates
 * are in viewmodel-local space (not world space).
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Vector3, Euler } from 'three';
import type { Group } from 'three';
import { ViewmodelLayer } from '../../engine/rendering/ViewmodelLayer';
import { useViewmodelAnimation, type ViewmodelAnimationInput } from '../../engine/rendering/useViewmodelAnimation';
import { MuzzleFlash, triggerMuzzleFlash } from '../../engine/effects/MuzzleFlash';
import { useGameStore } from '../../stores/gameStore';
import { useCombatStore } from '../../stores/combatStore';
import { loadModel } from '../../services/assetManager';
import { devLog } from '../../engine/stores/devLogStore';
import type { WeaponType } from './physics/types';

const VM_POSITION = {
  /** Viewmodel offset from camera origin (left, down, forward). */
  X: -0.22,
  Y: -0.22,
  Z: -0.30,
} as const;

/**
 * Convergence — rotate the weapon so its barrel points at the crosshair.
 *
 * The weapon sits at (X, Y, Z) in camera space.  The crosshair corresponds to
 * a point on the camera's center axis at distance FOCAL_DIST.  We compute a
 * small yaw (around Y) and pitch (around X) so the weapon's forward (-Z) axis
 * converges on that focal point instead of running parallel to the camera.
 *
 * A shorter FOCAL_DIST exaggerates the convergence angle — at 4 units the
 * barrel visibly rotates ~3° inward, which reads as "aiming at the crosshair"
 * even though true geometric convergence only needs ~0.6° at 20 units.
 *
 * With the weapon on the LEFT side (negative X), atan2(-0.22, 4) gives a
 * negative yaw → rotates right toward center. atan2 handles the sign
 * automatically.
 */
const CONVERGENCE = {
  FOCAL_DIST: 4,
  /** ~3.1° inward yaw — negative because weapon is left of center. */
  YAW: Math.atan2(-0.22, 4),
  /** ~3.1° upward pitch so barrel converges vertically too. */
  PITCH: Math.atan2(0.22, 4),
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
  // Sub-offset within the viewmodel group (on top of VM_POSITION).
  OFFSET_X: 0.00,
  OFFSET_Y: -0.05,
  OFFSET_Z: 0.05,
} as const;

// Pre-allocated geometries for fallback/knife
const knifeGeometry = new BoxGeometry(0.02, 0.02, 0.3);

// Pre-allocated vectors for muzzle flash positioning (zero GC)
const _muzzleOffset = new Vector3();
const _muzzleEuler = new Euler();

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
      // Apply transform: scale + rotate so barrel points -Z
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
    // drawTimer is decremented in the useFrame below using real delta

    // Detect fire event (cooldown transitions from 0 to >0)
    // NOTE: prevFireCooldown is updated at end of useFrame, not here,
    // so that both getInput and useFrame see the same transition.
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

  // Apply animation offset, decrement timers with real delta, trigger muzzle flash
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const state = stateRef.current;
    const dt = Math.min(delta, 0.05); // cap for tab-away

    // Decrement draw timer with actual frame delta (frame-rate independent)
    if (state.drawTimer > 0) {
      state.drawTimer = Math.max(0, state.drawTimer - dt);
    }

    group.position.set(
      VM_POSITION.X + anim.posX,
      VM_POSITION.Y + anim.posY,
      VM_POSITION.Z + anim.posZ,
    );
    // Rotation = convergence (crosshair lock) + recoil kick.
    // anim.rotY is always 0 (look sway removed from rotation output).
    // anim.rotX is recoil only — pass through at full strength.
    group.rotation.set(
      CONVERGENCE.PITCH + anim.rotX,
      CONVERGENCE.YAW + anim.rotY,
      anim.rotZ,
    );

    // Trigger muzzle flash on fire (coordinates are viewmodel-local)
    const combat = useCombatStore.getState();
    const justFired = combat.fireCooldown > 0 && state.prevFireCooldown === 0;
    if (justFired && combat.activeWeapon !== 'knife') {
      const [r, g, b] = MUZZLE_COLORS[combat.activeWeapon];
      // Barrel tip offset in local space, rotated to match group rotation
      _muzzleOffset.set(0, 0.02, -0.4);
      _muzzleEuler.set(
        CONVERGENCE.PITCH + anim.rotX,
        CONVERGENCE.YAW + anim.rotY,
        anim.rotZ,
      );
      _muzzleOffset.applyEuler(_muzzleEuler);
      triggerMuzzleFlash(
        group.position.x + _muzzleOffset.x,
        group.position.y + _muzzleOffset.y,
        group.position.z + _muzzleOffset.z,
        r, g, b,
      );
    }

    // Update prevFireCooldown AFTER the check so next frame detects the transition
    state.prevFireCooldown = combat.fireCooldown;
  });

  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const color = WEAPON_COLORS[activeWeapon];
  const isKnife = activeWeapon === 'knife';

  return (
    <group ref={groupRef}>
      {isKnife ? (
        // Knife: simple blade shape
        <mesh geometry={knifeGeometry} position={[0, 0, -0.15]}>
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        </mesh>
      ) : (
        // Gun: 3D rifle model with inline fallback box while loading
        <group>
          {rifleModel ? (
            <primitive object={rifleModel} />
          ) : (
            <mesh>
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
