/**
 * Procedural viewmodel animation hook.
 *
 * Drives idle sway, movement bob, fire recoil, and draw/holster transitions
 * for a first-person weapon viewmodel. All state is injected via props —
 * no game store imports (engine code).
 *
 * Returns a position + rotation offset to apply to the viewmodel group.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';

const VM_ANIM = {
  // Idle sway
  SWAY_SPEED: 1.2,
  SWAY_AMOUNT_X: 0.003,
  SWAY_AMOUNT_Y: 0.002,

  // Movement bob
  BOB_SPEED: 10,
  BOB_AMOUNT_X: 0.02,
  BOB_AMOUNT_Y: 0.015,
  BOB_SPEED_SCALE: 0.003,

  // Recoil
  RECOIL_KICK_Z: 0.06,
  RECOIL_KICK_ROT_X: 0.08,
  RECOIL_RECOVERY_SPEED: 12,

  // Draw/holster
  DRAW_SPEED: 6,
  DRAW_OFFSET_Y: -0.4,

  // Mouse look sway — position-only lag (weapon trails the camera spatially)
  LOOK_SWAY_FACTOR: 0.0015,
  LOOK_SWAY_RECOVERY: 8,

  // Lerp speed for smooth transitions (higher = tighter anchor)
  LERP_SPEED: 18,
} as const;

export interface ViewmodelAnimationInput {
  /** Horizontal speed (units/sec). */
  speed: number;
  /** Whether the player is on the ground. */
  grounded: boolean;
  /** True on the frame a weapon fires (triggers recoil). */
  isFiring: boolean;
  /** True while draw animation is playing (weapon being pulled out). */
  isDrawing: boolean;
  /** Mouse delta X this frame (pixels). */
  mouseDeltaX: number;
  /** Mouse delta Y this frame (pixels). */
  mouseDeltaY: number;
}

export interface ViewmodelAnimationOutput {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

// Pre-allocated output — mutated in-place each frame
const _output: ViewmodelAnimationOutput = {
  posX: 0, posY: 0, posZ: 0,
  rotX: 0, rotY: 0, rotZ: 0,
};

export function useViewmodelAnimation(
  getInput: () => ViewmodelAnimationInput,
): ViewmodelAnimationOutput {
  const timeRef = useRef(0);
  const recoilRef = useRef(0);
  const drawRef = useRef(1); // 1 = fully drawn, 0 = holstered
  const lookSwayXRef = useRef(0);
  const lookSwayYRef = useRef(0);

  // Smoothed values
  const smoothPosXRef = useRef(0);
  const smoothPosYRef = useRef(0);
  const smoothPosZRef = useRef(0);
  const smoothRotXRef = useRef(0);
  const smoothRotYRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // cap for tab-away
    const input = getInput();
    timeRef.current += dt;
    const t = timeRef.current;

    // ── Idle sway ──
    const swayX = Math.sin(t * VM_ANIM.SWAY_SPEED) * VM_ANIM.SWAY_AMOUNT_X;
    const swayY = Math.cos(t * VM_ANIM.SWAY_SPEED * 0.7) * VM_ANIM.SWAY_AMOUNT_Y;

    // ── Movement bob ──
    const bobScale = input.grounded
      ? MathUtils.clamp(input.speed * VM_ANIM.BOB_SPEED_SCALE, 0, 1)
      : 0;
    const bobPhase = t * VM_ANIM.BOB_SPEED * Math.min(input.speed * 0.005, 1.5);
    const bobX = Math.sin(bobPhase) * VM_ANIM.BOB_AMOUNT_X * bobScale;
    const bobY = Math.abs(Math.sin(bobPhase * 0.5)) * VM_ANIM.BOB_AMOUNT_Y * bobScale;

    // ── Recoil ──
    if (input.isFiring) {
      recoilRef.current = 1;
    }
    recoilRef.current = MathUtils.lerp(recoilRef.current, 0, 1 - Math.exp(-VM_ANIM.RECOIL_RECOVERY_SPEED * dt));
    const recoilZ = recoilRef.current * VM_ANIM.RECOIL_KICK_Z;
    const recoilRotX = recoilRef.current * VM_ANIM.RECOIL_KICK_ROT_X;

    // ── Draw/holster ──
    const drawTarget = input.isDrawing ? 0 : 1;
    drawRef.current = MathUtils.lerp(drawRef.current, drawTarget, 1 - Math.exp(-VM_ANIM.DRAW_SPEED * dt));
    const drawOffset = (1 - drawRef.current) * VM_ANIM.DRAW_OFFSET_Y;

    // ── Mouse look sway ──
    lookSwayXRef.current = MathUtils.lerp(
      lookSwayXRef.current,
      -input.mouseDeltaX * VM_ANIM.LOOK_SWAY_FACTOR,
      1 - Math.exp(-VM_ANIM.LOOK_SWAY_RECOVERY * dt),
    );
    lookSwayYRef.current = MathUtils.lerp(
      lookSwayYRef.current,
      -input.mouseDeltaY * VM_ANIM.LOOK_SWAY_FACTOR,
      1 - Math.exp(-VM_ANIM.LOOK_SWAY_RECOVERY * dt),
    );

    // ── Combine ──
    // Look sway affects POSITION only (weapon trails the camera spatially).
    // Rotation is driven exclusively by recoil — convergence in Viewmodel.tsx
    // handles crosshair alignment, and we must not fight it with sway rotation.
    const targetPosX = swayX + bobX + lookSwayXRef.current;
    const targetPosY = swayY - bobY + drawOffset + lookSwayYRef.current;
    const targetPosZ = -recoilZ;
    const targetRotX = -recoilRotX;
    const targetRotY = 0;

    // Smooth final values
    const lerpFactor = 1 - Math.exp(-VM_ANIM.LERP_SPEED * dt);
    smoothPosXRef.current = MathUtils.lerp(smoothPosXRef.current, targetPosX, lerpFactor);
    smoothPosYRef.current = MathUtils.lerp(smoothPosYRef.current, targetPosY, lerpFactor);
    smoothPosZRef.current = MathUtils.lerp(smoothPosZRef.current, targetPosZ, lerpFactor);
    smoothRotXRef.current = MathUtils.lerp(smoothRotXRef.current, targetRotX, lerpFactor);
    smoothRotYRef.current = MathUtils.lerp(smoothRotYRef.current, targetRotY, lerpFactor);

    // Write to pre-allocated output
    _output.posX = smoothPosXRef.current;
    _output.posY = smoothPosYRef.current;
    _output.posZ = smoothPosZRef.current;
    _output.rotX = smoothRotXRef.current;
    _output.rotY = smoothRotYRef.current;
    _output.rotZ = 0;
  });

  return _output;
}
