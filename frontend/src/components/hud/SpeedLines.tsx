import { useCallback } from 'react';
import { SpeedLines as EngineSpeedLines } from '../../engine/hud';
import { useGameStore } from '../../stores/gameStore';

export function SpeedLines() {
  const getSpeed = useCallback(() => useGameStore.getState().speed, []);
  return <EngineSpeedLines getSpeed={getSpeed} />;
}
