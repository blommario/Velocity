import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils } from 'three';
import { useGameStore } from '../../stores/gameStore';

const SCREEN_SHAKE = {
  DECAY: 8,
  MAX_OFFSET: 0.15,
  FREQUENCY: 25,
} as const;

/**
 * Reads `shakeIntensity` from gameStore and applies camera offset.
 * Intensity is set externally (e.g. by explosions in Phase 7).
 * Decays exponentially each frame.
 */
export function ScreenShake() {
  const { camera } = useThree();
  const intensityRef = useRef(0);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    const storeIntensity = useGameStore.getState().shakeIntensity;
    if (storeIntensity > intensityRef.current) {
      intensityRef.current = storeIntensity;
    }

    if (intensityRef.current < 0.001) {
      intensityRef.current = 0;
      return;
    }

    timeRef.current += delta;
    const t = timeRef.current * SCREEN_SHAKE.FREQUENCY;
    const offset = intensityRef.current * SCREEN_SHAKE.MAX_OFFSET;

    camera.position.x += Math.sin(t * 1.1) * offset;
    camera.position.y += Math.cos(t * 1.3) * offset;

    intensityRef.current = MathUtils.lerp(intensityRef.current, 0, 1 - Math.exp(-SCREEN_SHAKE.DECAY * delta));

    if (intensityRef.current < 0.001) {
      useGameStore.getState().clearShake();
    }
  });

  return null;
}
