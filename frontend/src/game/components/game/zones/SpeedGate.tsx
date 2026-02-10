/**
 * Speed gate zone -- multiplies the player's horizontal velocity on entry, with a minimum speed floor and particle effects.
 * Depends on: SensorZone, GpuParticles, combatStore (pushZoneEvent), PHYSICS constants
 * Used by: MapLoader, TestMap
 */
import { SensorZone } from '@engine/components';
import { PHYSICS } from '../physics/constants';
import { useCombatStore } from '@game/stores/combatStore';
import { GpuParticles } from '@engine/effects/GpuParticles';

const GATE_PARTICLES = {
  COUNT: 150,
  SPREAD: 2.5,
  SPEED: 1.5,
} as const;

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
    <SensorZone position={position} size={size} positionTarget="body" onEnter={handleEnter}>
      {/* Ring frame */}
      <mesh>
        <torusGeometry args={[size[0] / 2, 0.15, 8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
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
          emissiveIntensity={1.0}
          transparent
          opacity={0.15}
          side={2}
        />
      </mesh>
      <GpuParticles
        count={GATE_PARTICLES.COUNT}
        position={position}
        color={color}
        spread={GATE_PARTICLES.SPREAD}
        speed={GATE_PARTICLES.SPEED}
        direction={[0, 0.5, 0]}
      />
    </SensorZone>
  );
}
