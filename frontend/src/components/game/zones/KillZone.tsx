import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useGameStore } from '../../../stores/gameStore';

const KILL_ZONE_COLOR = '#ff0000';
const KILL_ZONE_OPACITY = 0.15;

interface KillZoneProps {
  position: [number, number, number];
  size: [number, number, number];
  visible?: boolean;
}

export function KillZone({ position, size, visible = false }: KillZoneProps) {
  const handleIntersection = () => {
    useGameStore.getState().requestRespawn();
  };

  return (
    <RigidBody type="fixed" colliders={false} sensor>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        position={position}
        sensor
        onIntersectionEnter={handleIntersection}
      />
      {visible && (
        <mesh position={position}>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={KILL_ZONE_COLOR}
            transparent
            opacity={KILL_ZONE_OPACITY}
          />
        </mesh>
      )}
    </RigidBody>
  );
}
