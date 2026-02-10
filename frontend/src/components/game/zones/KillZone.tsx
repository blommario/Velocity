import { SensorZone } from '../../../engine/components';
import { useGameStore } from '../../../stores/gameStore';

const KILL_ZONE_COLOR = '#ff0000';
const KILL_ZONE_OPACITY = 0.15;

interface KillZoneProps {
  position: [number, number, number];
  size: [number, number, number];
  visible?: boolean;
}

export function KillZone({ position, size, visible = false }: KillZoneProps) {
  const handleEnter = () => {
    useGameStore.getState().requestRespawn();
  };

  return (
    <SensorZone position={position} size={size} onEnter={handleEnter}>
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
    </SensorZone>
  );
}
