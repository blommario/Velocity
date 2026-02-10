/**
 * Game-specific track progress bar wrapper — reads checkpoint progress and run state from gameStore and renders the engine progress bar with checkpoint markers.
 * Depends on: EngineTrackProgressBar, gameStore
 * Used by: HudOverlay
 */
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
