import { useRef, useMemo, useState } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { LightsNode } from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useTexturedMaterial } from '../../../hooks/useTexturedMaterial';
import { batchStaticColliders } from '../../../engine/physics/colliderBatch';
import { useSpatialCulling } from '../../../engine/rendering/useSpatialCulling';
import { splitByLod, LOD_GEOMETRY, LOD_THRESHOLDS } from '../../../engine/rendering/LodManager';
import type { TileLightingNode } from '../../../engine/rendering/tileLightingNode';
import type { MapBlock } from './types';
import { useInstanceMatrix, getGeometry, useLightingBinding } from './blockUtils';
import type { BlockGroup, BlockGroupProps } from './blockUtils';
import { ProceduralBlockGroup } from './ProceduralBlockGroup';

// Re-export types used by other block group components
export type { BlockGroup, BlockGroupProps };

const CULLING_THRESHOLD = 500;

const CULLING_CONFIG = {
  viewRadius: LOD_THRESHOLDS.HIDDEN + LOD_THRESHOLDS.HYSTERESIS,
  cellSize: 32,
} as const;

const LOD_UPDATE_INTERVAL = 0.25;

// ── Block grouping ──

function groupBlocks(blocks: MapBlock[]): BlockGroup[] {
  const groups = new Map<string, BlockGroup>();

  for (const block of blocks) {
    const emissive = block.emissive ?? '#000000';
    const emissiveIntensity = block.emissiveIntensity ?? 0;
    const transparent = block.transparent ?? false;
    const opacity = block.opacity ?? 1;
    const textureSet = block.textureSet ?? '';
    const textureScale = block.textureScale ?? [1, 1];
    const roughness = block.roughness;
    const metalness = block.metalness;
    const proc = block.proceduralMaterial ?? '';
    const emAnim = block.emissiveAnimation ?? '';
    const emAnimSpeed = block.emissiveAnimationSpeed ?? 1;
    const blendTs = block.blendTextureSet ?? '';
    const blendProc = block.blendProceduralMaterial ?? '';
    const blendMode = block.blendMode ?? '';
    const blendH = block.blendHeight ?? '';
    const blendS = block.blendSharpness ?? '';

    const key = `${block.shape}|${block.color}|${emissive}|${emissiveIntensity}|${transparent}|${opacity}|${textureSet}|${textureScale[0]},${textureScale[1]}|${roughness ?? ''}|${metalness ?? ''}|${proc}|${emAnim}|${emAnimSpeed}|${blendTs}|${blendProc}|${blendMode}|${blendH}|${blendS}`;

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
        roughness: block.roughness,
        metalness: block.metalness,
        proceduralMaterial: block.proceduralMaterial,
        emissiveAnimation: block.emissiveAnimation,
        emissiveAnimationSpeed: block.emissiveAnimationSpeed,
        blendTextureSet: block.blendTextureSet,
        blendProceduralMaterial: block.blendProceduralMaterial,
        blendMode: block.blendMode,
        blendHeight: block.blendHeight,
        blendSharpness: block.blendSharpness,
        blocks: [],
      };
      groups.set(key, group);
    }
    group.blocks.push(block);
  }

  return Array.from(groups.values());
}

// ── Visual block group renderers ──

function TexturedBlockGroup({ group, cylinderSegments, lightsNode, tileLightingNode }: BlockGroupProps) {
  const meshRef = useInstanceMatrix(group.blocks);
  const scale = group.textureScale ?? [1, 1];
  const geometry = getGeometry(group.shape, cylinderSegments);

  const result = useTexturedMaterial(
    group.textureSet
      ? {
          textureSet: group.textureSet,
          repeatX: scale[0],
          repeatY: scale[1],
          color: group.color,
          emissive: group.emissive !== '#000000' ? group.emissive : undefined,
          emissiveIntensity: group.emissiveIntensity || undefined,
          roughnessOverride: group.roughness,
          metalnessOverride: group.metalness,
          emissiveAnimation: group.emissiveAnimation,
          emissiveAnimationSpeed: group.emissiveAnimationSpeed,
          blendTextureSet: group.blendTextureSet,
          blendMode: group.blendMode,
          blendHeight: group.blendHeight,
          blendSharpness: group.blendSharpness,
        }
      : null,
  );

  useLightingBinding(meshRef, lightsNode, tileLightingNode);

  useFrame((state) => {
    if (result?.timeUniform) result.timeUniform.value = state.clock.elapsedTime;
  });

  if (!result) {
    return (
      <instancedMesh ref={meshRef} args={[geometry, undefined, group.blocks.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color={group.color} />
      </instancedMesh>
    );
  }

  return (
    <instancedMesh ref={meshRef} args={[geometry, result.material, group.blocks.length]} castShadow receiveShadow frustumCulled />
  );
}

function FlatBlockGroup({ group, cylinderSegments, lightsNode, tileLightingNode }: BlockGroupProps) {
  const meshRef = useInstanceMatrix(group.blocks);
  const geometry = getGeometry(group.shape, cylinderSegments);
  useLightingBinding(meshRef, lightsNode, tileLightingNode);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, group.blocks.length]} castShadow receiveShadow frustumCulled>
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
  return groups.map((group) => {
    if (group.proceduralMaterial) {
      return <ProceduralBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />;
    }
    if (group.textureSet) {
      return <TexturedBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />;
    }
    return <FlatBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />;
  });
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

  useMemo(() => {
    grid.clear();
    if (!useLod) return;
    for (let i = 0; i < blocks.length; i++) {
      const pos = blocks[i].position;
      grid.insert(pos[0], pos[2], i);
    }
  }, [blocks, grid, useLod]);

  const visibleBlocks = useMemo(() => {
    if (!useLod || activeCells.size === 0) return blocks;
    const visible: MapBlock[] = [];
    activeCells.forEach((key) => {
      const indices = grid.getCellByKey(key);
      for (const idx of indices) visible.push(blocks[idx]);
    });
    return visible;
  }, [blocks, activeCells, grid, useLod]);

  const lodTimerRef = useRef(0);
  const [lodSplit, setLodSplit] = useState<{ near: MapBlock[]; far: MapBlock[] }>({
    near: visibleBlocks, far: [],
  });

  useFrame(({ camera }, delta) => {
    if (!useLod) return;
    lodTimerRef.current += delta;
    if (lodTimerRef.current < LOD_UPDATE_INTERVAL) return;
    lodTimerRef.current = 0;
    const [near, far] = splitByLod(visibleBlocks, camera.position.x, camera.position.z);
    setLodSplit({ near, far });
  });

  const nearBlocks = useLod ? lodSplit.near : visibleBlocks;
  const farBlocks = useLod ? lodSplit.far : [];
  const nearGroups = useMemo(() => groupBlocks(nearBlocks), [nearBlocks]);
  const farGroups = useMemo(() => groupBlocks(farBlocks), [farBlocks]);
  const colliderGroups = useMemo(() => batchStaticColliders(blocks), [blocks]);

  return (
    <group>
      {renderGroups(nearGroups, LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL, lightsNode, tileLightingNode)}
      {renderGroups(farGroups, LOD_GEOMETRY.CYLINDER_SEGMENTS_SIMPLE, lightsNode, tileLightingNode)}
      {colliderGroups.map((group, gi) => (
        <RigidBody key={`${group.shape}-${gi}`} type="fixed" colliders={false}>
          {group.colliders.map((col, i) =>
            col.shape === 'cylinder' ? (
              <CylinderCollider key={i} args={[col.args[0], col.args[1]]} position={col.position} rotation={col.rotation} />
            ) : (
              <CuboidCollider key={i} args={col.args} position={col.position} rotation={col.rotation} />
            ),
          )}
        </RigidBody>
      ))}
    </group>
  );
}
