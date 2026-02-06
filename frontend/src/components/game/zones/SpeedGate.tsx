import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { PHYSICS } from '../physics/constants';
import { useCombatStore } from '../../../stores/combatStore';

interface SpeedGateProps {
  position: [number, number, number];
  size?: [number, number, number];
  multiplier?: number;
  minSpeed?: number;
  color?: string;
}

export function SpeedGate({
  position,
  size = [5, 5, 1],
  multiplier = PHYSICS.SPEED_GATE_MULTIPLIER,
  minSpeed = PHYSICS.SPEED_GATE_MIN_SPEED,
  color = '#00ccff',
}: SpeedGateProps) {
  const handleEnter = () => {
    useCombatStore.getState().pushZoneEvent({ type: 'speedGate', multiplier, minSpeed });
  };

  return (
    <RigidBody type="fixed" colliders={false} position={position} sensor>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        sensor
        onIntersectionEnter={handleEnter}
      />
      {/* Ring frame */}
      <mesh>
        <torusGeometry args={[size[0] / 2, 0.15, 8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.5}
        />
      </mesh>
      {/* Inner glow plane */}
      <mesh>
        <planeGeometry args={[size[0] - 0.5, size[1] - 0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.15}
          side={2}
        />
      </mesh>
    </RigidBody>
  );
}
