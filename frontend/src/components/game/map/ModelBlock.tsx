import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { RigidBody, MeshCollider } from '@react-three/rapier';
import type { Group } from 'three/webgpu';
import { loadModel } from '../../../services/assetManager';
import { devLog } from '../../../stores/devLogStore';
import type { MapModel } from './types';

interface ModelBlockProps {
  model: MapModel;
}

export function ModelBlock({ model }: ModelBlockProps) {
  const [scene, setScene] = useState<Group | null>(null);
  const groupRef = useRef<Group>(null);
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
    };
  }, [model.modelUrl, invalidate]);

  if (!scene) return null;

  const position = model.position;
  const rotation = model.rotation ?? [0, 0, 0];
  const scale = model.scale ?? [1, 1, 1];

  if (model.collider === 'none' || !model.collider) {
    return (
      <group
        ref={groupRef}
        position={position}
        rotation={rotation}
        scale={scale}
      >
        <primitive object={scene} />
      </group>
    );
  }

  return (
    <RigidBody type="fixed" colliders={false}>
      <MeshCollider type={model.collider === 'hull' ? 'hull' : 'trimesh'}>
        <group
          ref={groupRef}
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
