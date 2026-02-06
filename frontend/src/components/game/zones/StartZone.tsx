import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useGameStore, RUN_STATES } from '../../../stores/gameStore';

const START_ZONE_COLOR = '#00ff88';
const START_ZONE_OPACITY = 0.25;

interface StartZoneProps {
  position: [number, number, number];
  size: [number, number, number];
}

export function StartZone({ position, size }: StartZoneProps) {
  const handleIntersection = () => {
    const state = useGameStore.getState();
    if (state.runState === RUN_STATES.READY) {
      state.startRun();
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
          color={START_ZONE_COLOR}
          transparent
          opacity={START_ZONE_OPACITY}
          emissive={START_ZONE_COLOR}
          emissiveIntensity={0.3}
        />
      </mesh>
    </RigidBody>
  );
}
