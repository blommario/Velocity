/**
 * Game-specific stance indicator wrapper — reads the player stance (stand/crouch/slide) from gameStore and passes it to the engine StanceIndicator display.
 * Depends on: EngineStanceIndicator, gameStore
 * Used by: HudOverlay
 */
import { StanceIndicator as EngineStanceIndicator } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function StanceIndicator() {
  const stance = useGameStore((s) => s.stance);
  return <EngineStanceIndicator stance={stance} />;
}
