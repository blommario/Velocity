/**
 * Game-specific timer wrapper — reads elapsed run time from gameStore and passes it to the engine Timer display.
 * Depends on: EngineTimer, gameStore
 * Used by: HudOverlay
 */
import { Timer as EngineTimer } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function Timer() {
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  return <EngineTimer time={elapsedMs} />;
}
