/**
 * Game-specific checkpoint counter — reads current/total checkpoint state from gameStore and passes it to the engine HUD primitive.
 * Depends on: EngineCheckpointCounter, gameStore
 * Used by: HudOverlay
 */
import { CheckpointCounter as EngineCheckpointCounter } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function CheckpointCounter() {
  const current = useGameStore((s) => s.currentCheckpoint);
  const total = useGameStore((s) => s.totalCheckpoints);
  return <EngineCheckpointCounter current={current} total={total} />;
}
