import { CheckpointCounter as EngineCheckpointCounter } from '../../engine/hud';
import { useGameStore } from '../../stores/gameStore';

export function CheckpointCounter() {
  const current = useGameStore((s) => s.currentCheckpoint);
  const total = useGameStore((s) => s.totalCheckpoints);
  return <EngineCheckpointCounter current={current} total={total} />;
}
