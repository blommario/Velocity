import { StanceIndicator as EngineStanceIndicator } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function StanceIndicator() {
  const stance = useGameStore((s) => s.stance);
  return <EngineStanceIndicator stance={stance} />;
}
