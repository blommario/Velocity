import { useEffect, useRef, useMemo } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Object3D, InstancedMesh, Euler, Color } from 'three';
import { useTexturedMaterial } from '../../../hooks/useTexturedMaterial';
import type { MapBlock, Vec3 } from './types';

interface BlockGroup {
  key: string;
  shape: MapBlock['shape'];
  color: string;
  emissive: string;
  emissiveIntensity: number;
  transparent: boolean;
  opacity: number;
  textureSet?: string;
  textureScale?: [number, number];
  blocks: MapBlock[];
}

function groupBlocks(blocks: MapBlock[]): BlockGroup[] {
  const groups = new Map<string, BlockGroup>();

  for (const block of blocks) {
    const emissive = block.emissive ?? '#000000';
    const emissiveIntensity = block.emissiveIntensity ?? 0;
    const transparent = block.transparent ?? false;
    const opacity = block.opacity ?? 1;
    const textureSet = block.textureSet ?? '';
    const textureScale = block.textureScale ?? [1, 1];

    const key = `${block.shape}|${block.color}|${emissive}|${emissiveIntensity}|${transparent}|${opacity}|${textureSet}|${textureScale[0]},${textureScale[1]}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        shape: block.shape,
        color: block.color,
        emissive,
        emissiveIntensity,
        transparent,
        opacity,
        textureSet: textureSet || undefined,
        textureScale: block.textureScale,
        blocks: [],
      };
      groups.set(key, group);
    }
    group.blocks.push(block);
  }

  return Array.from(groups.values());
}

function useInstanceMatrix(blocks: MapBlock[]) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const rot = block.rotation ?? [0, 0, 0];

      dummy.position.set(block.position[0], block.position[1], block.position[2]);
      dummy.rotation.copy(new Euler(rot[0], rot[1], rot[2]));
      dummy.scale.set(block.size[0], block.size[1], block.size[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [blocks, dummy]);

  return meshRef;
}

function TexturedBlockGroup({ group }: { group: BlockGroup }) {
  const meshRef = useInstanceMatrix(group.blocks);
  const scale = group.textureScale ?? [1, 1];

  const material = useTexturedMaterial(
    group.textureSet
      ? {
          textureSet: group.textureSet,
          repeatX: scale[0],
          repeatY: scale[1],
          emissive: group.emissive !== '#000000' ? group.emissive : undefined,
          emissiveIntensity: group.emissiveIntensity || undefined,
        }
      : null,
  );

  if (!material) {
    // Fallback to flat color while loading
    return (
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, group.blocks.length]}
        castShadow
        receiveShadow
      >
        {group.shape === 'cylinder' ? (
          <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
        ) : (
          <boxGeometry args={[1, 1, 1]} />
        )}
        <meshStandardMaterial color={group.color} />
      </instancedMesh>
    );
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, group.blocks.length]}
      castShadow
      receiveShadow
      material={material}
    >
      {group.shape === 'cylinder' ? (
        <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
    </instancedMesh>
  );
}

function FlatBlockGroup({ group }: { group: BlockGroup }) {
  const meshRef = useInstanceMatrix(group.blocks);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, group.blocks.length]}
      castShadow
      receiveShadow
    >
      {group.shape === 'cylinder' ? (
        <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      <meshStandardMaterial
        color={group.color}
        emissive={group.emissive}
        emissiveIntensity={group.emissiveIntensity}
        transparent={group.transparent}
        opacity={group.opacity}
      />
    </instancedMesh>
  );
}

interface InstancedBlocksProps {
  blocks: MapBlock[];
}

export function InstancedBlocks({ blocks }: InstancedBlocksProps) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);

  return (
    <group>
      {/* Visual instanced meshes */}
      {groups.map((group) =>
        group.textureSet ? (
          <TexturedBlockGroup key={group.key} group={group} />
        ) : (
          <FlatBlockGroup key={group.key} group={group} />
        ),
      )}

      {/* Physics colliders — must remain individual per block */}
      {blocks.map((block, i) => {
        const rot = block.rotation ?? [0, 0, 0];
        const halfSize: Vec3 = [block.size[0] / 2, block.size[1] / 2, block.size[2] / 2];

        return (
          <RigidBody key={`col-${i}`} type="fixed" colliders={false}>
            {block.shape === 'cylinder' ? (
              <CylinderCollider
                args={[halfSize[1], halfSize[0]]}
                position={block.position}
                rotation={rot}
              />
            ) : (
              <CuboidCollider
                args={halfSize}
                position={block.position}
                rotation={rot}
              />
            )}
          </RigidBody>
        );
      })}
    </group>
  );
}
