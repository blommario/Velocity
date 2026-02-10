import { SensorZone } from '../../../engine/components';
import { useGameStore, RUN_STATES } from '../../../stores/gameStore';
import { audioManager, SOUNDS } from '../../../engine/audio/AudioManager';

const FINISH_ZONE_COLOR = '#ff3366';
const FINISH_ZONE_OPACITY = 0.3;

interface FinishZoneProps {
  position: [number, number, number];
  size: [number, number, number];
}

export function FinishZone({ position, size }: FinishZoneProps) {
  const handleEnter = () => {
    const state = useGameStore.getState();
    if (state.runState === RUN_STATES.RUNNING) {
      state.finishRun();
      audioManager.play(SOUNDS.FINISH);
    }
  };

  return (
    <SensorZone position={position} size={size} onEnter={handleEnter}>
      <mesh position={position}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={FINISH_ZONE_COLOR}
          transparent
          opacity={FINISH_ZONE_OPACITY}
          emissive={FINISH_ZONE_COLOR}
          emissiveIntensity={1.5}
        />
      </mesh>
    </SensorZone>
  );
}
