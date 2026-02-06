import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useGameStore, RUN_STATES } from '../../../stores/gameStore';
import { audioManager, SOUNDS } from '../../../systems/AudioManager';

const CHECKPOINT_COLOR = '#ffaa00';
const CHECKPOINT_OPACITY = 0.2;

interface CheckpointProps {
  position: [number, number, number];
  size: [number, number, number];
  index: number;
}

export function Checkpoint({ position, size, index }: CheckpointProps) {
  const handleIntersection = () => {
    const state = useGameStore.getState();
    if (state.runState === RUN_STATES.RUNNING) {
      state.hitCheckpoint(index);
      audioManager.play(SOUNDS.CHECKPOINT);
    }
  };

  return (
    <RigidBody type="fixed" colliders={false} sensor>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        position={position}
        sensor
        onIntersectionEnter={handleIntersection}
      />
      <mesh position={position}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={CHECKPOINT_COLOR}
          transparent
          opacity={CHECKPOINT_OPACITY}
          emissive={CHECKPOINT_COLOR}
          emissiveIntensity={0.2}
        />
      </mesh>
    </RigidBody>
  );
}
