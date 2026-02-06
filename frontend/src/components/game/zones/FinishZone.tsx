import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useGameStore, RUN_STATES } from '../../../stores/gameStore';

const FINISH_ZONE_COLOR = '#ff3366';
const FINISH_ZONE_OPACITY = 0.3;

interface FinishZoneProps {
  position: [number, number, number];
  size: [number, number, number];
}

export function FinishZone({ position, size }: FinishZoneProps) {
  const handleIntersection = () => {
    const state = useGameStore.getState();
    if (state.runState === RUN_STATES.RUNNING) {
      state.finishRun();
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
          color={FINISH_ZONE_COLOR}
          transparent
          opacity={FINISH_ZONE_OPACITY}
          emissive={FINISH_ZONE_COLOR}
          emissiveIntensity={0.4}
        />
      </mesh>
    </RigidBody>
  );
}
