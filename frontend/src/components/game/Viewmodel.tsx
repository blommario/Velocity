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
import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, Vector3, Euler } from 'three';
import { ViewmodelLayer } from '../../engine/rendering/ViewmodelLayer';
import { useViewmodelAnimation, type ViewmodelAnimationInput } from '../../engine/rendering/useViewmodelAnimation';
import { MuzzleFlash, triggerMuzzleFlash } from '../../engine/effects/MuzzleFlash';
import { useGameStore } from '../../stores/gameStore';
import { useCombatStore } from '../../stores/combatStore';
import type { WeaponType } from './physics/types';

const VM_POSITION = {
  /** Viewmodel offset from camera origin (right, down, forward). */
  X: 0.25,
  Y: -0.2,
  Z: -0.5,
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

// Pre-allocated geometries (shared across renders)
const barrelGeometry = new CylinderGeometry(0.02, 0.025, 0.35, 8);
barrelGeometry.rotateX(Math.PI / 2);
const bodyGeometry = new BoxGeometry(0.06, 0.05, 0.15);
const handleGeometry = new BoxGeometry(0.04, 0.1, 0.04);
const knifeGeometry = new BoxGeometry(0.02, 0.02, 0.3);

// Pre-allocated vectors for muzzle flash positioning (zero GC)
const _muzzleOffset = new Vector3();
const _muzzleEuler = new Euler();

interface ViewmodelState {
  prevWeapon: WeaponType;
  drawTimer: number;
  prevFireCooldown: number;
}

function ViewmodelContent() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseDeltaRef = useRef<[number, number]>([0, 0]);
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
    group.rotation.set(anim.rotX, anim.rotY, anim.rotZ);

    // Trigger muzzle flash on fire (coordinates are viewmodel-local)
    const combat = useCombatStore.getState();
    const justFired = combat.fireCooldown > 0 && state.prevFireCooldown === 0;
    if (justFired && combat.activeWeapon !== 'knife') {
      const [r, g, b] = MUZZLE_COLORS[combat.activeWeapon];
      // Barrel tip offset in local space, rotated by the current viewmodel rotation
      // so the flash stays attached to the barrel during recoil/sway
      _muzzleOffset.set(0, 0.01, -0.35);
      _muzzleEuler.set(anim.rotX, anim.rotY, anim.rotZ);
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
        // Gun: barrel + body + handle
        <group>
          <mesh geometry={barrelGeometry} position={[0, 0.01, -0.15]}>
            <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh geometry={bodyGeometry} position={[0, 0, 0.02]}>
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh geometry={handleGeometry} position={[0, -0.06, 0.05]}>
            <meshStandardMaterial color="#222222" metalness={0.3} roughness={0.6} />
          </mesh>
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
