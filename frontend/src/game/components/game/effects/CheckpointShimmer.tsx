/**
 * Gold particle burst effect triggered when the player crosses a checkpoint.
 * Delegates rendering to the engine ObjectHighlight component.
 *
 * Depends on: @engine/effects/ObjectHighlight, @game/stores/gameStore
 * Used by: GameCanvas
 */
import { useRef, useCallback } from 'react';
import { ObjectHighlight } from '@engine/effects/ObjectHighlight';
import { useGameStore } from '@game/stores/gameStore';

const SHIMMER_CONFIG = {
  particleCount: 32,
  spread: 3,
  riseSpeed: 2,
  life: 1.5,
  size: 0.15,
  color: '#ffd700',
} as const;

export function CheckpointShimmer() {
  const lastCheckpointRef = useRef(-1);

  const getBurstPosition = useCallback((): [number, number, number] | null => {
    const cp = useGameStore.getState().currentCheckpoint;
    const pos = useGameStore.getState().position;

    if (cp > lastCheckpointRef.current && lastCheckpointRef.current >= 0) {
      lastCheckpointRef.current = cp;
      return [pos[0], pos[1], pos[2]];
    }
    lastCheckpointRef.current = cp;
    return null;
  }, []);

  return <ObjectHighlight getBurstPosition={getBurstPosition} config={SHIMMER_CONFIG} />;
}
