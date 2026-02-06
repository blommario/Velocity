import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { PHYSICS } from '../physics/constants';
import { useCombatStore } from '../../../stores/combatStore';

interface LaunchPadProps {
  position: [number, number, number];
  size?: [number, number, number];
  direction: [number, number, number]; // direction + angle of launch (normalized)
  speed?: number;
  color?: string;
}

export function LaunchPad({
  position,
  size = [3, 0.3, 3],
  direction,
  speed = PHYSICS.LAUNCH_PAD_DEFAULT_SPEED,
  color = '#ff6600',
}: LaunchPadProps) {
  const handleEnter = () => {
    useCombatStore.getState().pushZoneEvent({ type: 'launchPad', direction, speed });
  };

  return (
    <RigidBody type="fixed" colliders={false} position={position} sensor>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        sensor
        onIntersectionEnter={handleEnter}
      />
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.0}
          transparent
          opacity={0.7}
        />
      </mesh>
    </RigidBody>
  );
}
