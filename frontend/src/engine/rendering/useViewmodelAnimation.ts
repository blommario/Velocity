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
  inspectOffsetX: number;
  inspectOffsetY: number;
  inspectOffsetZ: number;
  inspectSpinSpeed: number;
  reloadDipY: number;
  reloadDipZ: number;
  reloadRotX: number;
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
  inspectOffsetX: -0.04,
  inspectOffsetY: 0.15,
  inspectOffsetZ: -0.08,
  inspectSpinSpeed: 0.8,
  reloadDipY: -0.25,
  reloadDipZ: 0.05,
  reloadRotX: 0.3,
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
  /** ADS progress (0 = hip, 1 = fully aimed). Reduces sway/bob. */
  adsProgress?: number;
  /** Inspect progress (0 = hip, 1 = fully inspecting). Overrides bob/sway. */
  inspectProgress?: number;
  /** Reload progress (0 = start, 1 = complete). Dips weapon down during reload. */
  reloadProgress?: number;
}

export interface ViewmodelAnimationOutput {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export function useViewmodelAnimation(
  getInput: () => ViewmodelAnimationInput,
  config: ViewmodelAnimationConfig = VM_ANIM_DEFAULTS,
): ViewmodelAnimationOutput {
  // Instance-scoped output — safe for multiple viewmodels (dual-wield, split-screen)
  const outputRef = useRef<ViewmodelAnimationOutput>({
    posX: 0, posY: 0, posZ: 0,
    rotX: 0, rotY: 0, rotZ: 0,
  });
  const timeRef = useRef(0);
  const recoilRef = useRef(0);
  const drawRef = useRef(1); // 1 = fully drawn, 0 = holstered
  const lookSwayXRef = useRef(0);
  const lookSwayYRef = useRef(0);
  const tiltRef = useRef(0);
  const inspectSpinRef = useRef(0);

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

    // ── ADS dampening ──
    const ads = input.adsProgress ?? 0;
    const swayDamp = 1 - ads * 0.8;   // reduce sway 80% at full ADS
    const bobDamp = 1 - ads * 0.9;    // reduce bob 90% at full ADS
    const lookDamp = 1 - ads * 0.7;   // reduce look-sway 70% at full ADS

    // ── Idle sway ──
    const swayX = Math.sin(t * c.swaySpeed) * c.swayAmountX * swayDamp;
    const swayY = Math.cos(t * c.swaySpeed * 0.7) * c.swayAmountY * swayDamp;

    // ── Movement bob ──
    const bobScale = input.grounded
      ? MathUtils.clamp(input.speed * c.bobSpeedScale, 0, 1)
      : 0;
    const bobPhase = t * c.bobSpeed * Math.min(input.speed * 0.005, 1.5);
    const bobX = Math.sin(bobPhase) * c.bobAmountX * bobScale * bobDamp;
    const bobY = Math.abs(Math.sin(bobPhase * 0.5)) * c.bobAmountY * bobScale * bobDamp;

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
      -input.mouseDeltaX * c.lookSwayFactor * lookDamp,
      1 - Math.exp(-c.lookSwayRecovery * dt),
    );
    lookSwayYRef.current = MathUtils.lerp(
      lookSwayYRef.current,
      -input.mouseDeltaY * c.lookSwayFactor * lookDamp,
      1 - Math.exp(-c.lookSwayRecovery * dt),
    );

    // ── Banking/tilt — weapon rolls when looking left/right ──
    tiltRef.current = MathUtils.lerp(
      tiltRef.current,
      input.mouseDeltaX * c.tiltFactor,
      1 - Math.exp(-c.tiltRecovery * dt),
    );

    // ── Inspect spin ──
    const inspect = input.inspectProgress ?? 0;
    if (inspect > 0.01) {
      inspectSpinRef.current += c.inspectSpinSpeed * dt;
    } else {
      // Reset spin when not inspecting (wrap to avoid large values)
      inspectSpinRef.current = 0;
    }

    // ── Reload dip ──
    // Progress 0→0.4: weapon dips down, 0.4→0.7: stays low, 0.7→1.0: comes back up
    const reload = input.reloadProgress ?? 0;
    let reloadDipAmount = 0;
    if (reload > 0) {
      if (reload < 0.4) {
        reloadDipAmount = reload / 0.4;                     // ramp down
      } else if (reload < 0.7) {
        reloadDipAmount = 1;                                 // hold low
      } else {
        reloadDipAmount = (1 - reload) / 0.3;               // ramp back up
      }
    }

    // ── Combine ──
    const hipPosX = swayX + bobX + lookSwayXRef.current;
    const hipPosY = swayY - bobY + drawOffset + lookSwayYRef.current + reloadDipAmount * c.reloadDipY;
    const hipPosZ = -recoilZ + reloadDipAmount * c.reloadDipZ;
    const hipRotX = -recoilRotX + reloadDipAmount * c.reloadRotX;
    const hipRotY = 0;
    const hipRotZ = -tiltRef.current;

    // Blend between hip and inspect pose (no inspect during reload)
    const effectiveInspect = reload > 0 ? 0 : inspect;
    const targetPosX = hipPosX + (c.inspectOffsetX - hipPosX) * effectiveInspect;
    const targetPosY = hipPosY + (c.inspectOffsetY - hipPosY) * effectiveInspect;
    const targetPosZ = hipPosZ + (c.inspectOffsetZ - hipPosZ) * effectiveInspect;
    const targetRotX = hipRotX * (1 - effectiveInspect);
    const targetRotY = hipRotY + inspectSpinRef.current * effectiveInspect;
    const targetRotZ = hipRotZ * (1 - effectiveInspect);

    // Smooth final values
    const lerpFactor = 1 - Math.exp(-c.lerpSpeed * dt);
    smoothPosXRef.current = MathUtils.lerp(smoothPosXRef.current, targetPosX, lerpFactor);
    smoothPosYRef.current = MathUtils.lerp(smoothPosYRef.current, targetPosY, lerpFactor);
    smoothPosZRef.current = MathUtils.lerp(smoothPosZRef.current, targetPosZ, lerpFactor);
    smoothRotXRef.current = MathUtils.lerp(smoothRotXRef.current, targetRotX, lerpFactor);
    smoothRotYRef.current = MathUtils.lerp(smoothRotYRef.current, targetRotY, lerpFactor);
    smoothRotZRef.current = MathUtils.lerp(smoothRotZRef.current, targetRotZ, lerpFactor);

    // Write to instance-scoped output (mutated in-place, zero GC)
    const out = outputRef.current;
    out.posX = smoothPosXRef.current;
    out.posY = smoothPosYRef.current;
    out.posZ = smoothPosZRef.current;
    out.rotX = smoothRotXRef.current;
    out.rotY = smoothRotYRef.current;
    out.rotZ = smoothRotZRef.current;
  });

  return outputRef.current;
}
