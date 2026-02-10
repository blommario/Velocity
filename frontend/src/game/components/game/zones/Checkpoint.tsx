/**
 * Checkpoint trigger zone -- records a checkpoint hit when the player enters during an active run.
 * Depends on: SensorZone, gameStore (hitCheckpoint), AudioManager
 * Used by: MapLoader, TestMap
 */
import { SensorZone } from '@engine/components';
import { useGameStore, RUN_STATES } from '@game/stores/gameStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';

const CHECKPOINT_COLOR = '#ffaa00';
const CHECKPOINT_OPACITY = 0.2;

interface CheckpointProps {
  position: [number, number, number];
  size: [number, number, number];
  index: number;
}

export function Checkpoint({ position, size, index }: CheckpointProps) {
  const handleEnter = () => {
    const state = useGameStore.getState();
    if (state.runState === RUN_STATES.RUNNING) {
      state.hitCheckpoint(index);
      audioManager.play(SOUNDS.CHECKPOINT);
    }
  };

  return (
    <SensorZone position={position} size={size} onEnter={handleEnter}>
      <mesh position={position}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={CHECKPOINT_COLOR}
          transparent
          opacity={CHECKPOINT_OPACITY}
          emissive={CHECKPOINT_COLOR}
          emissiveIntensity={1.0}
        />
      </mesh>
    </SensorZone>
  );
}
