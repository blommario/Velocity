/**
 * Boost pad zone -- applies a directional velocity boost to the player on contact, with particle effects.
 * Depends on: SensorZone, GpuParticles, combatStore (pushZoneEvent), PHYSICS constants
 * Used by: MapLoader, TestMap
 */
import { SensorZone } from '@engine/components';
import { PHYSICS } from '../physics/constants';
import { useCombatStore } from '@game/stores/combatStore';
import { GpuParticles } from '@engine/effects/GpuParticles';

const BOOST_PARTICLES = {
  COUNT: 200,
  SPREAD: 1.5,
  SPEED: 2.0,
} as const;

interface BoostPadProps {
  position: [number, number, number];
  size?: [number, number, number];
  direction: [number, number, number]; // normalized direction of boost
  speed?: number;
  color?: string;
}

export function BoostPad({
  position,
  size = [3, 0.2, 3],
  direction,
  speed = PHYSICS.BOOST_PAD_DEFAULT_SPEED,
  color = '#00ff88',
}: BoostPadProps) {
  const handleEnter = () => {
    useCombatStore.getState().pushZoneEvent({ type: 'boostPad', direction, speed });
  };

  return (
    <SensorZone position={position} size={size} positionTarget="body" onEnter={handleEnter}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Arrow indicator */}
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, Math.atan2(direction[0], direction[2])]}>
        <planeGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.0}
          transparent
          opacity={0.4}
        />
      </mesh>
      <GpuParticles
        count={BOOST_PARTICLES.COUNT}
        position={position}
        color={color}
        spread={BOOST_PARTICLES.SPREAD}
        speed={BOOST_PARTICLES.SPEED}
        direction={[0, 1, 0]}
      />
    </SensorZone>
  );
}
