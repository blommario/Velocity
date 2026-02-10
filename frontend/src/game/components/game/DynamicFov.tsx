/**
 * Dynamic FOV — widens at high speeds, narrows during ADS. Lerps smoothly.
 *
 * Depends on: settingsStore, gameStore, combatStore, ADS_CONFIG
 * Used by: GameCanvas
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera } from 'three';
import { useSettingsStore } from '@game/stores/settingsStore';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { ADS_CONFIG } from './physics/constants';

const FOV_SCALING = {
  BASE: 90,
  MAX: 120,
  SPEED_START: 400,
  SPEED_FULL: 800,
  LERP_SPEED: 5,
} as const;

const FOV_EPSILON = 0.01;

export function DynamicFov() {
  const { camera } = useThree();
  const targetFovRef = useRef<number>(FOV_SCALING.BASE);

  useFrame((_, delta) => {
    const baseFov = useSettingsStore.getState().fov;
    const speed = useGameStore.getState().speed;

    const speedFraction = MathUtils.clamp(
      (speed - FOV_SCALING.SPEED_START) / (FOV_SCALING.SPEED_FULL - FOV_SCALING.SPEED_START),
      0, 1,
    );
    const maxFov = baseFov + (FOV_SCALING.MAX - FOV_SCALING.BASE);
    const speedFov = baseFov + speedFraction * (maxFov - baseFov);

    const combat = useCombatStore.getState();
    const weaponAdsFov = ADS_CONFIG[combat.activeWeapon].fov as number;
    targetFovRef.current = MathUtils.lerp(speedFov, weaponAdsFov, combat.adsProgress);

    const cam = camera as PerspectiveCamera;
    const newFov = MathUtils.lerp(cam.fov, targetFovRef.current, 1 - Math.exp(-FOV_SCALING.LERP_SPEED * delta));

    if (Math.abs(newFov - cam.fov) > FOV_EPSILON) {
      cam.fov = newFov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
