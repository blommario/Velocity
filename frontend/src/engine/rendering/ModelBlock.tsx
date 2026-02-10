import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import type { Group } from 'three/webgpu';
import { distanceSqXZ, LOD_THRESHOLDS } from './LodManager';
import { devLog } from '../stores/devLogStore';
import type { MapModel } from '../types/map';

/** How often to check distance for LOD visibility (seconds) */
const LOD_CHECK_INTERVAL = 0.5;

/** Model loader function signature — injected from game layer */
export type LoadModelFn = (url: string) => Promise<Group>;

export interface ModelBlockProps {
  model: MapModel;
  /** Inject model loader from game layer */
  loadModel: LoadModelFn;
}

export function ModelBlock({ model, loadModel }: ModelBlockProps) {
  const [scene, setScene] = useState<Group | null>(null);
  const [visible, setVisible] = useState(true);
  const groupRef = useRef<Group>(null);
  const lodTimerRef = useRef(0);
  const { invalidate } = useThree();

  useEffect(() => {
    let disposed = false;

    loadModel(model.modelUrl)
      .then((loaded) => {
        if (disposed) return;
        setScene(loaded);
        invalidate();
      })
      .catch((err) => {
        devLog.error('ModelBlock', `Failed to load ${model.modelUrl}: ${err instanceof Error ? err.message : String(err)}`);
      });

    return () => {
      disposed = true;
      // Geometry/material dispose handled centrally by clearAssetCache() on map change.
      // Clone shares buffers with cached original — disposing here would corrupt the cache.
    };
  }, [model.modelUrl, invalidate, loadModel]);

  // Distance-based visibility at ~2Hz
  useFrame(({ camera }, delta) => {
    lodTimerRef.current += delta;
    if (lodTimerRef.current < LOD_CHECK_INTERVAL) return;
    lodTimerRef.current = 0;

    const dSq = distanceSqXZ(
      model.position[0], model.position[2],
      camera.position.x, camera.position.z,
    );
    const shouldShow = dSq <= LOD_THRESHOLDS.HIDDEN ** 2;
    if (shouldShow !== visible) setVisible(shouldShow);
  });

  if (!scene) return null;

  const position = model.position;
  const rotation = model.rotation ?? [0, 0, 0];
  const scale = model.scale ?? [1, 1, 1];

  if (model.collider === 'none' || !model.collider) {
    return (
      <group
        ref={groupRef}
        visible={visible}
        position={position}
        rotation={rotation}
        scale={scale}
      >
        <primitive object={scene} />
      </group>
    );
  }

  // Keep RigidBody always mounted so physics colliders persist even when
  // the mesh is visually hidden (LOD). Only toggle Three.js `visible`.
  return (
    <RigidBody type="fixed" colliders={false}>
      <MeshCollider type={model.collider === 'hull' ? 'hull' : 'trimesh'}>
        <group
          ref={groupRef}
          visible={visible}
          position={position}
          rotation={rotation}
          scale={scale}
        >
          <primitive object={scene} />
        </group>
      </MeshCollider>
    </RigidBody>
  );
}
