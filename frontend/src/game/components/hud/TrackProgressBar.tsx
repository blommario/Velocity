import { TrackProgressBar as EngineTrackProgressBar } from '@engine/hud';
import { useGameStore, RUN_STATES } from '@game/stores/gameStore';

export function TrackProgressBar() {
  const current = useGameStore((s) => s.currentCheckpoint);
  const total = useGameStore((s) => s.totalCheckpoints);
  const runState = useGameStore((s) => s.runState);

  if (total === 0) return null;

  return (
    <EngineTrackProgressBar
      current={current}
      total={total + 1}
      completed={runState === RUN_STATES.FINISHED}
      markerCount={total}
    />
  );
}
