import { useState } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { WeaponType } from '../physics/types';
import { useCombatStore } from '../../../stores/combatStore';

interface AmmoPickupProps {
  position: [number, number, number];
  type: WeaponType;
  amount: number;
  respawnTime?: number; // seconds, 0 = no respawn
}

const AMMO_COLORS: Record<WeaponType, string> = {
  rocket: '#ff4444',
  grenade: '#44ff44',
};

const DEFAULT_RESPAWN_TIME = 10;

export function AmmoPickup({ position, type, amount, respawnTime = DEFAULT_RESPAWN_TIME }: AmmoPickupProps) {
  const color = AMMO_COLORS[type];
  const [collected, setCollected] = useState(false);

  const handleEnter = () => {
    if (collected) return;
    useCombatStore.getState().pushZoneEvent({ type: 'ammoPickup', weaponType: type, amount });
    setCollected(true);
    if (respawnTime > 0) {
      setTimeout(() => setCollected(false), respawnTime * 1000);
    }
  };

  if (collected) return null;

  return (
    <RigidBody type="fixed" colliders={false} position={position} sensor>
      <CuboidCollider
        args={[0.4, 0.4, 0.4]}
        sensor
        onIntersectionEnter={handleEnter}
      />
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>
    </RigidBody>
  );
}
