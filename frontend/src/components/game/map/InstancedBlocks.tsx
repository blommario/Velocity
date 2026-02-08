import { useEffect, useRef, useMemo, useState } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Object3D, InstancedMesh, Euler, BoxGeometry, CylinderGeometry } from 'three';
import type { LightsNode, MeshStandardMaterial } from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useTexturedMaterial } from '../../../hooks/useTexturedMaterial';
import { batchStaticColliders } from '../../../engine/physics/colliderBatch';
import { useSpatialCulling } from '../../../engine/rendering/useSpatialCulling';
import { splitByLod, LOD_GEOMETRY, LOD_THRESHOLDS } from '../../../engine/rendering/LodManager';
import { applyTileLighting, removeTileLighting } from '../../../engine/rendering/lightMaterial';
import type { TileLightingNode } from '../../../engine/rendering/tileLightingNode';
import type { MapBlock } from './types';

/** Block count threshold for enabling spatial culling + LOD */
const CULLING_THRESHOLD = 500;

const CULLING_CONFIG = {
  /** Must match or exceed LOD_THRESHOLDS.HIDDEN + HYSTERESIS so LOD controls visibility */
  viewRadius: LOD_THRESHOLDS.HIDDEN + LOD_THRESHOLDS.HYSTERESIS,
  cellSize: 32,
} as const;

/** How often to recalculate LOD splits (seconds) */
const LOD_UPDATE_INTERVAL = 0.25;

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

// Shared geometries — created once, reused across all block groups
const _boxGeometry = new BoxGeometry(1, 1, 1);
const _cylinderGeometryFull = new CylinderGeometry(0.5, 0.5, 1, LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL);
const _cylinderGeometrySimple = new CylinderGeometry(0.5, 0.5, 1, LOD_GEOMETRY.CYLINDER_SEGMENTS_SIMPLE);

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

// ── Visual block group renderers ──

function getGeometry(shape: MapBlock['shape'], cylinderSegments: number) {
  if (shape === 'cylinder') {
    return cylinderSegments >= LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL
      ? _cylinderGeometryFull
      : _cylinderGeometrySimple;
  }
  return _boxGeometry;
}

interface BlockGroupProps {
  group: BlockGroup;
  cylinderSegments: number;
  lightsNode?: LightsNode;
  tileLightingNode?: TileLightingNode;
}

/** Apply lightsNode or tileLightingNode to an InstancedMesh's material after mount. */
function useLightingBinding(
  meshRef: React.RefObject<InstancedMesh | null>,
  lightsNode?: LightsNode,
  tileLightingNode?: TileLightingNode,
) {
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat = mesh.material as MeshStandardMaterial;

    if (tileLightingNode) {
      applyTileLighting(mat, tileLightingNode);
      return () => { removeTileLighting(mat); };
    } else if (lightsNode) {
      const nodeMat = mat as MeshStandardMaterial & { lightsNode?: LightsNode | null };
      if ('lightsNode' in nodeMat) {
        nodeMat.lightsNode = lightsNode;
      }
    }
  }, [meshRef, lightsNode, tileLightingNode]);
}

function TexturedBlockGroup({ group, cylinderSegments, lightsNode, tileLightingNode }: BlockGroupProps) {
  const meshRef = useInstanceMatrix(group.blocks);
  const scale = group.textureScale ?? [1, 1];
  const geometry = getGeometry(group.shape, cylinderSegments);

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

  useLightingBinding(meshRef, lightsNode, tileLightingNode);

  if (!material) {
    return (
      <instancedMesh
        ref={meshRef}
        args={[geometry, undefined, group.blocks.length]}
        castShadow
        receiveShadow
        frustumCulled
      >
        <meshStandardMaterial color={group.color} />
      </instancedMesh>
    );
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, group.blocks.length]}
      castShadow
      receiveShadow
      frustumCulled
    />
  );
}

function FlatBlockGroup({ group, cylinderSegments, lightsNode, tileLightingNode }: BlockGroupProps) {
  const meshRef = useInstanceMatrix(group.blocks);
  const geometry = getGeometry(group.shape, cylinderSegments);

  useLightingBinding(meshRef, lightsNode, tileLightingNode);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, group.blocks.length]}
      castShadow
      receiveShadow
      frustumCulled
    >
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

function renderGroups(
  groups: BlockGroup[],
  cylinderSegments: number,
  lightsNode?: LightsNode,
  tileLightingNode?: TileLightingNode,
) {
  return groups.map((group) =>
    group.textureSet ? (
      <TexturedBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />
    ) : (
      <FlatBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />
    ),
  );
}

// ── Main component ──

interface InstancedBlocksProps {
  blocks: MapBlock[];
  lightsNode?: LightsNode;
  tileLightingNode?: TileLightingNode;
}

export function InstancedBlocks({ blocks, lightsNode, tileLightingNode }: InstancedBlocksProps) {
  const useLod = blocks.length >= CULLING_THRESHOLD;
  const { grid, activeCells } = useSpatialCulling<number>(
    useLod ? CULLING_CONFIG : { viewRadius: Infinity, cellSize: CULLING_CONFIG.cellSize },
  );

  // Populate grid with block indices (once per blocks change)
  useMemo(() => {
    grid.clear();
    if (!useLod) return;
    for (let i = 0; i < blocks.length; i++) {
      const pos = blocks[i].position;
      grid.insert(pos[0], pos[2], i);
    }
  }, [blocks, grid, useLod]);

  // Filter visible blocks — O(active cells × items/cell)
  const visibleBlocks = useMemo(() => {
    if (!useLod || activeCells.size === 0) return blocks;

    const visible: MapBlock[] = [];
    activeCells.forEach((key) => {
      const indices = grid.getCellByKey(key);
      for (const idx of indices) {
        visible.push(blocks[idx]);
      }
    });
    return visible;
  }, [blocks, activeCells, grid, useLod]);

  // LOD split: camera position sampled at ~4Hz
  const lodTimerRef = useRef(0);
  const [lodSplit, setLodSplit] = useState<{ near: MapBlock[]; far: MapBlock[] }>({
    near: visibleBlocks,
    far: [],
  });

  useFrame(({ camera }, delta) => {
    if (!useLod) return;
    lodTimerRef.current += delta;
    if (lodTimerRef.current < LOD_UPDATE_INTERVAL) return;
    lodTimerRef.current = 0;

    const [near, far] = splitByLod(visibleBlocks, camera.position.x, camera.position.z);
    setLodSplit({ near, far });
  });

  // When not using LOD, or on first render before useFrame fires
  const nearBlocks = useLod ? lodSplit.near : visibleBlocks;
  const farBlocks = useLod ? lodSplit.far : [];

  const nearGroups = useMemo(() => groupBlocks(nearBlocks), [nearBlocks]);
  const farGroups = useMemo(() => groupBlocks(farBlocks), [farBlocks]);

  // Physics colliders always include ALL blocks
  const colliderGroups = useMemo(() => batchStaticColliders(blocks), [blocks]);

  return (
    <group>
      {/* Near: full-detail geometry */}
      {renderGroups(nearGroups, LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL, lightsNode, tileLightingNode)}

      {/* Far: simplified geometry */}
      {renderGroups(farGroups, LOD_GEOMETRY.CYLINDER_SEGMENTS_SIMPLE, lightsNode, tileLightingNode)}

      {/* Physics colliders — batched compound rigid bodies */}
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
