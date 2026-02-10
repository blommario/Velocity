/**
 * Rocket instanced mesh setup — creates body + nose InstancedMesh for
 * rocket projectiles with emissive materials.
 *
 * Depends on: three (InstancedMesh, geometries, materials)
 * Used by: ProjectileRenderer
 */
import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  InstancedMesh, ConeGeometry, CylinderGeometry,
  MeshStandardMaterial, Vector3, Quaternion, Matrix4,
} from 'three';

export const ROCKET_MESH = {
  MAX_INSTANCES: 16,
  BODY_RADIUS: 0.25,
  BODY_LENGTH: 1.5,
  NOSE_RADIUS: 0.25,
  NOSE_LENGTH: 0.55,
  HIDDEN_Y: -9999,
} as const;

const _hiddenMatrix = new Matrix4().compose(
  new Vector3(0, ROCKET_MESH.HIDDEN_Y, 0),
  new Quaternion(),
  new Vector3(1, 1, 1),
);

export function useRocketInstances() {
  const { scene } = useThree();
  const bodyMeshRef = useRef<InstancedMesh | null>(null);
  const noseMeshRef = useRef<InstancedMesh | null>(null);

  useEffect(() => {
    const bodyGeo = new CylinderGeometry(
      ROCKET_MESH.BODY_RADIUS, ROCKET_MESH.BODY_RADIUS,
      ROCKET_MESH.BODY_LENGTH, 8,
    );
    bodyGeo.rotateX(Math.PI / 2);

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

    const bodyMesh = new InstancedMesh(bodyGeo, bodyMat, ROCKET_MESH.MAX_INSTANCES);
    bodyMesh.name = 'RocketBodies';
    bodyMesh.frustumCulled = false;
    bodyMesh.count = ROCKET_MESH.MAX_INSTANCES;

    const noseMesh = new InstancedMesh(noseGeo, noseMat, ROCKET_MESH.MAX_INSTANCES);
    noseMesh.name = 'RocketNoses';
    noseMesh.frustumCulled = false;
    noseMesh.count = ROCKET_MESH.MAX_INSTANCES;

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

  return { bodyMeshRef, noseMeshRef };
}
