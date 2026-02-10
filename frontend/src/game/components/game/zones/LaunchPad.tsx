/**
 * Launch pad zone -- catapults the player in a given direction at a set speed on contact.
 * Depends on: SensorZone, combatStore (pushZoneEvent), PHYSICS constants
 * Used by: MapLoader, TestMap
 */
import { SensorZone } from '@engine/components';
import { PHYSICS } from '../physics/constants';
import { useCombatStore } from '@game/stores/combatStore';

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
    <SensorZone position={position} size={size} positionTarget="body" onEnter={handleEnter}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.0}
          transparent
          opacity={0.7}
        />
      </mesh>
    </SensorZone>
  );
}
