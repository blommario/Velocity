import { useEffect, useRef, useMemo } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Object3D, InstancedMesh, Euler } from 'three';
import { useTexturedMaterial } from '../../../hooks/useTexturedMaterial';
import { batchStaticColliders } from '../../../engine/physics/colliderBatch';
import { useSpatialCulling } from '../../../engine/rendering/useSpatialCulling';
import type { MapBlock } from './types';

/** Block count threshold for enabling spatial culling */
const CULLING_THRESHOLD = 500;

const CULLING_CONFIG = {
  viewRadius: 200,
  cellSize: 32,
} as const;

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

const _blockEuler = new Euler();

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
      _blockEuler.set(rot[0], rot[1], rot[2]);
      dummy.rotation.copy(_blockEuler);
      dummy.scale.set(block.size[0], block.size[1], block.size[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
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
        frustumCulled
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
      frustumCulled
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
      frustumCulled
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
  const useCulling = blocks.length >= CULLING_THRESHOLD;
  const { grid, activeCells } = useSpatialCulling<number>(
    useCulling ? CULLING_CONFIG : { viewRadius: Infinity, cellSize: CULLING_CONFIG.cellSize },
  );

  // Populate grid with block indices (once per blocks change)
  useMemo(() => {
    grid.clear();
    if (!useCulling) return;
    for (let i = 0; i < blocks.length; i++) {
      const pos = blocks[i].position;
      grid.insert(pos[0], pos[2], i);
    }
  }, [blocks, grid, useCulling]);

  // Filter visible blocks — O(active cells × items/cell), NOT O(total blocks)
  const visibleBlocks = useMemo(() => {
    if (!useCulling || activeCells.size === 0) return blocks;

    const visible: MapBlock[] = [];
    activeCells.forEach((key) => {
      const indices = grid.getCellByKey(key);
      for (const idx of indices) {
        visible.push(blocks[idx]);
      }
    });
    return visible;
  }, [blocks, activeCells, grid, useCulling]);

  const groups = useMemo(() => groupBlocks(visibleBlocks), [visibleBlocks]);

  // Physics colliders always include ALL blocks (Rapier needs full collision)
  const colliderGroups = useMemo(() => batchStaticColliders(blocks), [blocks]);

  return (
    <group>
      {/* Visual instanced meshes (culled when 500+ blocks) */}
      {groups.map((group) =>
        group.textureSet ? (
          <TexturedBlockGroup key={group.key} group={group} />
        ) : (
          <FlatBlockGroup key={group.key} group={group} />
        ),
      )}

      {/* Physics colliders — batched into compound rigid bodies (1 per shape type) */}
      {colliderGroups.map((group) => (
        <RigidBody key={group.shape} type="fixed" colliders={false}>
          {group.colliders.map((col, i) =>
            col.shape === 'cylinder' ? (
              <CylinderCollider
                key={i}
                args={[col.args[0], col.args[1]]}
                position={col.position}
                rotation={col.rotation}
              />
            ) : (
              <CuboidCollider
                key={i}
                args={col.args}
                position={col.position}
                rotation={col.rotation}
              />
            ),
          )}
        </RigidBody>
      ))}
    </group>
  );
}
