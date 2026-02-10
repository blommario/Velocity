/**
 * Game-specific speed lines wrapper — provides a callback to read current player speed from gameStore for the engine speed lines visual effect.
 * Depends on: EngineSpeedLines, gameStore
 * Used by: HudOverlay
 */
import { useCallback } from 'react';
import { SpeedLines as EngineSpeedLines } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function SpeedLines() {
  const getSpeed = useCallback(() => useGameStore.getState().speed, []);
  return <EngineSpeedLines getSpeed={getSpeed} />;
}
