/**
 * Game-specific speed meter wrapper — reads the current player speed from gameStore and passes it to the engine SpeedMeter display.
 * Depends on: EngineSpeedMeter, gameStore
 * Used by: HudOverlay
 */
import { SpeedMeter as EngineSpeedMeter } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function SpeedMeter() {
  const speed = useGameStore((s) => s.speed);
  return <EngineSpeedMeter speed={speed} />;
}
