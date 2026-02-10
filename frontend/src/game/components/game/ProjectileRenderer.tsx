/**
 * ProjectileRenderer — reads mutable projectilePool and writes GPU sprite
 * slots (trails) + 3D rocket body/nose InstancedMesh transforms each frame.
 *
 * Depends on: GpuProjectiles, useGpuProjectileSlots, useRocketInstances, projectilePool
 * Used by: GameCanvas
 */
import { useFrame } from '@react-three/fiber';
import { GpuProjectiles, useGpuProjectileSlots } from '@engine/effects/GpuProjectiles';
import { getPool, getPoolSize } from './physics/projectilePool';
import { Vector3, Quaternion, Matrix4 } from 'three';
import { useRocketInstances, ROCKET_MESH } from './useRocketInstances';

/** Velocity projectile colors: 0=rocket, 1=grenade */
const PROJECTILE_COLORS: Record<number, [number, number, number]> = {
  0: [1.0, 0.4, 0.05],  // rocket — orange-red
  1: [0.3, 1.0, 0.1],   // grenade — bright green
} as const;

// Pre-allocated reusable objects — zero GC in render loop
const _vel = new Vector3();
const _forward = new Vector3(0, 0, 1);
const _quat = new Quaternion();
const _pos = new Vector3();
const _scale = new Vector3(1, 1, 1);
const _matrix = new Matrix4();
const _hiddenMatrix = new Matrix4().compose(
  new Vector3(0, ROCKET_MESH.HIDDEN_Y, 0),
  new Quaternion(),
  new Vector3(1, 1, 1),
);

// Nose offset along local +Z (pre-computed)
const NOSE_OFFSET_Z = ROCKET_MESH.BODY_LENGTH / 2 + ROCKET_MESH.NOSE_LENGTH / 2;
const _noseLocalOffset = new Vector3(0, 0, NOSE_OFFSET_Z);
const _noseWorldOffset = new Vector3();

export function ProjectileRenderer() {
  return <ProjectileBridge />;
}

function ProjectileBridge() {
  const slots = useGpuProjectileSlots();
  const { bodyMeshRef, noseMeshRef } = useRocketInstances();

  useFrame(() => {
    const pool = getPool();
    const poolSize = getPoolSize();
    const bodyMesh = bodyMeshRef.current;
    const noseMesh = noseMeshRef.current;

    // GPU sprite trail slots
    let slotIdx = 0;
    // Instanced mesh index (rockets only)
    let meshIdx = 0;

    for (let i = 0; i < poolSize; i++) {
      const p = pool[i];
      if (!p.active) continue;

      // Write GPU sprite slot (trails for both rockets and grenades)
      if (slotIdx < slots.length) {
        const s = slots[slotIdx++];
        s.setActive(true);
        s.setPosition(p.posX, p.posY, p.posZ);
        s.setType(p.type === 'rocket' ? 0 : 1);
      }

      // 3D oriented instance — rockets only
      if (p.type === 'rocket' && bodyMesh && noseMesh && meshIdx < ROCKET_MESH.MAX_INSTANCES) {
        const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY + p.velZ * p.velZ);
        if (speed > 0.01) {
          _vel.set(p.velX / speed, p.velY / speed, p.velZ / speed);
          _quat.setFromUnitVectors(_forward, _vel);
        }

        // Body: position at projectile center
        _pos.set(p.posX, p.posY, p.posZ);
        _matrix.compose(_pos, _quat, _scale);
        bodyMesh.setMatrixAt(meshIdx, _matrix);

        // Nose: offset forward along rocket direction
        _noseWorldOffset.copy(_noseLocalOffset).applyQuaternion(_quat);
        _pos.set(
          p.posX + _noseWorldOffset.x,
          p.posY + _noseWorldOffset.y,
          p.posZ + _noseWorldOffset.z,
        );
        _matrix.compose(_pos, _quat, _scale);
        noseMesh.setMatrixAt(meshIdx, _matrix);

        meshIdx++;
      }
    }

    // Hide unused instances
    if (bodyMesh && noseMesh) {
      for (let i = meshIdx; i < ROCKET_MESH.MAX_INSTANCES; i++) {
        bodyMesh.setMatrixAt(i, _hiddenMatrix);
        noseMesh.setMatrixAt(i, _hiddenMatrix);
      }
      bodyMesh.instanceMatrix.needsUpdate = true;
      noseMesh.instanceMatrix.needsUpdate = true;
    }

    // Deactivate unused GPU sprite slots
    for (let i = slotIdx; i < slots.length; i++) {
      slots[i].setActive(false);
    }
  });

  return <GpuProjectiles projectileColors={PROJECTILE_COLORS} />;
}
