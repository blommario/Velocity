/**
 * Thin bridge: reads mutable projectilePool → writes GPU sprite slots + 3D rocket meshes.
 * Trail rendering handled by engine GpuProjectiles (1 draw call).
 * Rocket bodies rendered as oriented 3D meshes (instanced pool, max 16).
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GpuProjectiles, useGpuProjectileSlots } from '../../engine/effects/GpuProjectiles';
import { getPool, getPoolSize } from './physics/projectilePool';
import {
  Mesh, ConeGeometry, CylinderGeometry, Group,
  MeshStandardMaterial, Vector3, Quaternion,
} from 'three';

/** Rocket mesh pool config */
const ROCKET_MESH = {
  MAX_POOL: 16,
  BODY_RADIUS: 0.12,
  BODY_LENGTH: 0.7,
  NOSE_RADIUS: 0.12,
  NOSE_LENGTH: 0.25,
  FIN_WIDTH: 0.06,
  FIN_HEIGHT: 0.2,
  FIN_DEPTH: 0.15,
  HIDDEN_Y: -9999,
} as const;

// Pre-allocated reusable vectors — zero GC
const _vel = new Vector3();
const _forward = new Vector3(0, 0, 1);
const _quat = new Quaternion();

export function ProjectileRenderer() {
  return <ProjectileBridge />;
}

function ProjectileBridge() {
  const slots = useGpuProjectileSlots();
  const { scene } = useThree();
  const meshPoolRef = useRef<Mesh[]>([]);
  const containerRef = useRef<Group | null>(null);

  // Create rocket mesh pool on mount
  useEffect(() => {
    const container = new Group();
    container.name = 'RocketMeshPool';
    scene.add(container);
    containerRef.current = container;

    // Shared geometries (created once, shared across all rockets)
    const bodyGeo = new CylinderGeometry(
      ROCKET_MESH.BODY_RADIUS, ROCKET_MESH.BODY_RADIUS,
      ROCKET_MESH.BODY_LENGTH, 8,
    );
    // Rotate so cylinder axis = +Z (forward)
    bodyGeo.rotateX(Math.PI / 2);

    const noseGeo = new ConeGeometry(
      ROCKET_MESH.NOSE_RADIUS, ROCKET_MESH.NOSE_LENGTH, 8,
    );
    // Rotate cone to point along +Z
    noseGeo.rotateX(-Math.PI / 2);
    // Offset nose to front of body
    noseGeo.translate(0, 0, ROCKET_MESH.BODY_LENGTH / 2 + ROCKET_MESH.NOSE_LENGTH / 2);

    // Merge into one geometry per rocket via child meshes in a group
    const rocketMat = new MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0xff4400,
      emissiveIntensity: 2.0,
    });

    const noseMat = new MeshStandardMaterial({
      color: 0xff2200,
      metalness: 0.5,
      roughness: 0.4,
      emissive: 0xff2200,
      emissiveIntensity: 3.0,
    });

    const meshPool: Mesh[] = [];

    for (let i = 0; i < ROCKET_MESH.MAX_POOL; i++) {
      // Use a group to hold body + nose as one unit
      const rocketGroup = new Group();
      rocketGroup.name = `Rocket_${i}`;

      const body = new Mesh(bodyGeo, rocketMat);
      body.frustumCulled = false;
      rocketGroup.add(body);

      const nose = new Mesh(noseGeo, noseMat);
      nose.frustumCulled = false;
      rocketGroup.add(nose);

      rocketGroup.visible = false;
      rocketGroup.position.set(0, ROCKET_MESH.HIDDEN_Y, 0);
      container.add(rocketGroup);

      // We store the group but type as Mesh for pool compat (position/quaternion/visible work the same on Group)
      meshPool.push(rocketGroup as unknown as Mesh);
    }

    meshPoolRef.current = meshPool;

    return () => {
      scene.remove(container);
      bodyGeo.dispose();
      noseGeo.dispose();
      rocketMat.dispose();
      noseMat.dispose();
      containerRef.current = null;
      meshPoolRef.current = [];
    };
  }, [scene]);

  useFrame(() => {
    const pool = getPool();
    const poolSize = getPoolSize();
    const meshPool = meshPoolRef.current;

    // GPU sprite trail slots
    let slotIdx = 0;
    // 3D mesh pool index (only rockets get meshes)
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

      // 3D oriented mesh — rockets only
      if (p.type === 'rocket' && meshIdx < meshPool.length) {
        const mesh = meshPool[meshIdx++];
        mesh.visible = true;
        mesh.position.set(p.posX, p.posY, p.posZ);

        // Orient mesh along velocity direction
        const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY + p.velZ * p.velZ);
        if (speed > 0.01) {
          _vel.set(p.velX / speed, p.velY / speed, p.velZ / speed);
          _quat.setFromUnitVectors(_forward, _vel);
          mesh.quaternion.copy(_quat);
        }
      }
    }

    // Deactivate unused GPU sprite slots
    for (let i = slotIdx; i < slots.length; i++) {
      slots[i].setActive(false);
    }

    // Hide unused rocket meshes
    for (let i = meshIdx; i < meshPool.length; i++) {
      if (meshPool[i].visible) {
        meshPool[i].visible = false;
        meshPool[i].position.y = ROCKET_MESH.HIDDEN_Y;
      }
    }
  });

  return <GpuProjectiles />;
}
