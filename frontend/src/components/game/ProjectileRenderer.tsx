/**
 * Thin bridge: reads mutable projectilePool → writes GPU sprite slots + 3D rocket meshes.
 * Trail rendering handled by engine GpuProjectiles (1 draw call).
 * Rocket bodies rendered via 2 InstancedMesh (body + nose) = 2 draw calls total.
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GpuProjectiles, useGpuProjectileSlots } from '../../engine/effects/GpuProjectiles';
import { getPool, getPoolSize } from './physics/projectilePool';
import {
  InstancedMesh, ConeGeometry, CylinderGeometry,
  MeshStandardMaterial, Vector3, Quaternion, Matrix4, Object3D,
} from 'three';

/** Rocket instanced mesh config */
const ROCKET_MESH = {
  MAX_INSTANCES: 16,
  BODY_RADIUS: 0.25,
  BODY_LENGTH: 1.5,
  NOSE_RADIUS: 0.25,
  NOSE_LENGTH: 0.55,
  HIDDEN_Y: -9999,
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
  const { scene } = useThree();
  const bodyMeshRef = useRef<InstancedMesh | null>(null);
  const noseMeshRef = useRef<InstancedMesh | null>(null);

  useEffect(() => {
    // Body geometry: cylinder aligned to +Z
    const bodyGeo = new CylinderGeometry(
      ROCKET_MESH.BODY_RADIUS, ROCKET_MESH.BODY_RADIUS,
      ROCKET_MESH.BODY_LENGTH, 8,
    );
    bodyGeo.rotateX(Math.PI / 2);

    // Nose geometry: cone pointing +Z
    const noseGeo = new ConeGeometry(
      ROCKET_MESH.NOSE_RADIUS, ROCKET_MESH.NOSE_LENGTH, 8,
    );
    noseGeo.rotateX(-Math.PI / 2);

    const bodyMat = new MeshStandardMaterial({
      color: 0xaa4400,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0xff6600,
      emissiveIntensity: 4.0,
    });

    const noseMat = new MeshStandardMaterial({
      color: 0xff3300,
      metalness: 0.4,
      roughness: 0.3,
      emissive: 0xff4400,
      emissiveIntensity: 5.0,
    });

    // 2 InstancedMesh: body (1 draw call) + nose (1 draw call)
    const bodyMesh = new InstancedMesh(bodyGeo, bodyMat, ROCKET_MESH.MAX_INSTANCES);
    bodyMesh.name = 'RocketBodies';
    bodyMesh.frustumCulled = false;
    bodyMesh.count = ROCKET_MESH.MAX_INSTANCES;

    const noseMesh = new InstancedMesh(noseGeo, noseMat, ROCKET_MESH.MAX_INSTANCES);
    noseMesh.name = 'RocketNoses';
    noseMesh.frustumCulled = false;
    noseMesh.count = ROCKET_MESH.MAX_INSTANCES;

    // Initialize all instances to hidden
    for (let i = 0; i < ROCKET_MESH.MAX_INSTANCES; i++) {
      bodyMesh.setMatrixAt(i, _hiddenMatrix);
      noseMesh.setMatrixAt(i, _hiddenMatrix);
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    noseMesh.instanceMatrix.needsUpdate = true;

    scene.add(bodyMesh);
    scene.add(noseMesh);
    bodyMeshRef.current = bodyMesh;
    noseMeshRef.current = noseMesh;

    return () => {
      scene.remove(bodyMesh);
      scene.remove(noseMesh);
      bodyGeo.dispose();
      noseGeo.dispose();
      bodyMat.dispose();
      noseMat.dispose();
      bodyMeshRef.current = null;
      noseMeshRef.current = null;
    };
  }, [scene]);

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

  return <GpuProjectiles />;
}
