import { useCallback } from 'react';
import { SpeedTrail as EngineSpeedTrail } from '../../../engine/effects/SpeedTrail';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';

const TRAIL_CONFIG = {
  speedThreshold: 400,
  maxPoints: 40,
  updateInterval: 0.03,
  baseColor: '#00ccff',
  fastColor: '#ff4400',
  speedForFast: 800,
} as const;

export function SpeedTrail() {
  const particles = useSettingsStore((s) => s.particles);

  const getSpeed = useCallback(() => useGameStore.getState().speed, []);
  const getPosition = useCallback((): [number, number, number] => {
    const p = useGameStore.getState().position;
    return [p[0], p[1], p[2]];
  }, []);

  return (
    <EngineSpeedTrail
      getSpeed={getSpeed}
      getPosition={getPosition}
      enabled={particles}
      config={TRAIL_CONFIG}
    />
  );
}
