/**
 * Thin bridge: reads mutable projectilePool → writes GPU sprite slots.
 * All rendering handled by engine GpuProjectiles (1 draw call).
 */
import { useFrame } from '@react-three/fiber';
import { GpuProjectiles, useGpuProjectileSlots } from '../../engine/effects/GpuProjectiles';
import { getPool, getPoolSize } from './physics/projectilePool';

export function ProjectileRenderer() {
  return <ProjectileBridge />;
}

function ProjectileBridge() {
  const slots = useGpuProjectileSlots();

  useFrame(() => {
    if (slots.length === 0) return;

    const pool = getPool();
    const poolSize = getPoolSize();
    let slotIdx = 0;

    for (let i = 0; i < poolSize; i++) {
      const p = pool[i];
      if (!p.active || slotIdx >= slots.length) continue;
      const s = slots[slotIdx++];
      s.setActive(true);
      s.setPosition(p.posX, p.posY, p.posZ);
      s.setType(p.type === 'rocket' ? 0 : 1);
    }

    // Deactivate unused slots
    for (let i = slotIdx; i < slots.length; i++) {
      slots[i].setActive(false);
    }
  });

  return <GpuProjectiles />;
}
