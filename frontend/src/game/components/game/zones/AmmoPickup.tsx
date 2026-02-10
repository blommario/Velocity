/**
 * Ammo pickup zone -- renders a color-coded box that grants ammo on contact and optionally respawns after a timer.
 * Depends on: SensorZone, combatStore (pushZoneEvent)
 * Used by: MapLoader, TestMap
 */
import { useState } from 'react';
import { SensorZone } from '@engine/components';
import type { WeaponType } from '../physics/types';
import { useCombatStore } from '@game/stores/combatStore';

interface AmmoPickupProps {
  position: [number, number, number];
  type: WeaponType;
  amount: number;
  respawnTime?: number; // seconds, 0 = no respawn
}

const AMMO_COLORS: Record<WeaponType, string> = {
  rocket: '#ff4444',
  grenade: '#44ff44',
  sniper: '#4488ff',
  assault: '#ffaa22',
  shotgun: '#cc8844',
  knife: '#cccccc',
  plasma: '#aa44ff',
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
    <SensorZone position={position} size={[0.8, 0.8, 0.8]} positionTarget="body" onEnter={handleEnter}>
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
    </SensorZone>
  );
}
