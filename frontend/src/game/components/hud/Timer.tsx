import { Timer as EngineTimer } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function Timer() {
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  return <EngineTimer time={elapsedMs} />;
}
