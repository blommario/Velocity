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

export interface ViewmodelAnimationConfig {
  swaySpeed: number;
  swayAmountX: number;
  swayAmountY: number;
  bobSpeed: number;
  bobAmountX: number;
  bobAmountY: number;
  bobSpeedScale: number;
  recoilKickZ: number;
  recoilKickRotX: number;
  recoilRecoverySpeed: number;
  drawSpeed: number;
  drawOffsetY: number;
  lookSwayFactor: number;
  lookSwayRecovery: number;
  tiltFactor: number;
  tiltRecovery: number;
  lerpSpeed: number;
}

export const VM_ANIM_DEFAULTS: ViewmodelAnimationConfig = {
  swaySpeed: 1.0,
  swayAmountX: 0.002,
  swayAmountY: 0.0015,
  bobSpeed: 11,
  bobAmountX: 0.018,
  bobAmountY: 0.012,
  bobSpeedScale: 0.003,
  recoilKickZ: 0.05,
  recoilKickRotX: 0.10,
  recoilRecoverySpeed: 10,
  drawSpeed: 8,
  drawOffsetY: -0.5,
  lookSwayFactor: 0.002,
  lookSwayRecovery: 10,
  tiltFactor: 0.002,
  tiltRecovery: 5,
  lerpSpeed: 20,
};

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
  config: ViewmodelAnimationConfig = VM_ANIM_DEFAULTS,
): ViewmodelAnimationOutput {
  const timeRef = useRef(0);
  const recoilRef = useRef(0);
  const drawRef = useRef(1); // 1 = fully drawn, 0 = holstered
  const lookSwayXRef = useRef(0);
  const lookSwayYRef = useRef(0);
  const tiltRef = useRef(0);

  // Smoothed values
  const smoothPosXRef = useRef(0);
  const smoothPosYRef = useRef(0);
  const smoothPosZRef = useRef(0);
  const smoothRotXRef = useRef(0);
  const smoothRotYRef = useRef(0);
  const smoothRotZRef = useRef(0);

  // Store config in ref so useFrame always reads latest without re-registering
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // cap for tab-away
    const input = getInput();
    const c = cfgRef.current;
    timeRef.current += dt;
    const t = timeRef.current;

    // ── Idle sway ──
    const swayX = Math.sin(t * c.swaySpeed) * c.swayAmountX;
    const swayY = Math.cos(t * c.swaySpeed * 0.7) * c.swayAmountY;

    // ── Movement bob ──
    const bobScale = input.grounded
      ? MathUtils.clamp(input.speed * c.bobSpeedScale, 0, 1)
      : 0;
    const bobPhase = t * c.bobSpeed * Math.min(input.speed * 0.005, 1.5);
    const bobX = Math.sin(bobPhase) * c.bobAmountX * bobScale;
    const bobY = Math.abs(Math.sin(bobPhase * 0.5)) * c.bobAmountY * bobScale;

    // ── Recoil ──
    if (input.isFiring) {
      recoilRef.current = 1;
    }
    recoilRef.current = MathUtils.lerp(recoilRef.current, 0, 1 - Math.exp(-c.recoilRecoverySpeed * dt));
    const recoilZ = recoilRef.current * c.recoilKickZ;
    const recoilRotX = recoilRef.current * c.recoilKickRotX;

    // ── Draw/holster ──
    const drawTarget = input.isDrawing ? 0 : 1;
    drawRef.current = MathUtils.lerp(drawRef.current, drawTarget, 1 - Math.exp(-c.drawSpeed * dt));
    const drawOffset = (1 - drawRef.current) * c.drawOffsetY;

    // ── Mouse look sway ──
    lookSwayXRef.current = MathUtils.lerp(
      lookSwayXRef.current,
      -input.mouseDeltaX * c.lookSwayFactor,
      1 - Math.exp(-c.lookSwayRecovery * dt),
    );
    lookSwayYRef.current = MathUtils.lerp(
      lookSwayYRef.current,
      -input.mouseDeltaY * c.lookSwayFactor,
      1 - Math.exp(-c.lookSwayRecovery * dt),
    );

    // ── Banking/tilt — weapon rolls when looking left/right ──
    tiltRef.current = MathUtils.lerp(
      tiltRef.current,
      input.mouseDeltaX * c.tiltFactor,
      1 - Math.exp(-c.tiltRecovery * dt),
    );

    // ── Combine ──
    const targetPosX = swayX + bobX + lookSwayXRef.current;
    const targetPosY = swayY - bobY + drawOffset + lookSwayYRef.current;
    const targetPosZ = -recoilZ;
    const targetRotX = -recoilRotX;
    const targetRotY = 0;
    const targetRotZ = -tiltRef.current;

    // Smooth final values
    const lerpFactor = 1 - Math.exp(-c.lerpSpeed * dt);
    smoothPosXRef.current = MathUtils.lerp(smoothPosXRef.current, targetPosX, lerpFactor);
    smoothPosYRef.current = MathUtils.lerp(smoothPosYRef.current, targetPosY, lerpFactor);
    smoothPosZRef.current = MathUtils.lerp(smoothPosZRef.current, targetPosZ, lerpFactor);
    smoothRotXRef.current = MathUtils.lerp(smoothRotXRef.current, targetRotX, lerpFactor);
    smoothRotYRef.current = MathUtils.lerp(smoothRotYRef.current, targetRotY, lerpFactor);
    smoothRotZRef.current = MathUtils.lerp(smoothRotZRef.current, targetRotZ, lerpFactor);

    // Write to pre-allocated output
    _output.posX = smoothPosXRef.current;
    _output.posY = smoothPosYRef.current;
    _output.posZ = smoothPosZRef.current;
    _output.rotX = smoothRotXRef.current;
    _output.rotY = smoothRotYRef.current;
    _output.rotZ = smoothRotZRef.current;
  });

  return _output;
}
