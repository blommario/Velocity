/**
 * InstancedBlocks — renders map blocks as instanced meshes grouped by
 * visual properties. Supports LOD, spatial culling, textured/procedural
 * materials, and tile-clustered lighting.
 *
 * Depends on: blockGrouping, blockUtils, LodManager, useSpatialCulling, colliderBatch
 * Used by: MapLoader
 */
import { useRef, useMemo, useState } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { LightsNode, MeshStandardNodeMaterial } from 'three/webgpu';

import { useFrame } from '@react-three/fiber';
import { batchStaticColliders } from '../physics/colliderBatch';
import { useSpatialCulling } from './useSpatialCulling';
import { splitByLod, LOD_GEOMETRY, LOD_THRESHOLDS } from './LodManager';
import type { TileLightingNode } from './tileLightingNode';
import type { MapBlock } from '../types/map';
import { useInstanceMatrix, getGeometry, useLightingBinding } from './blockUtils';
import type { BlockGroup, BlockGroupProps } from './blockUtils';
import { ProceduralBlockGroup } from './ProceduralBlockGroup';
import { groupBlocks } from './blockGrouping';

export type { BlockGroup, BlockGroupProps };

const CULLING_THRESHOLD = 500;

const CULLING_CONFIG = {
  viewRadius: LOD_THRESHOLDS.HIDDEN + LOD_THRESHOLDS.HYSTERESIS,
  cellSize: 32,
} as const;

const LOD_UPDATE_INTERVAL = 0.25;

// ── Textured material hook interface (injected by game layer) ──

export interface TexturedMaterialOptions {
  textureSet: string;
  repeatX?: number;
  repeatY?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughnessOverride?: number;
  metalnessOverride?: number;
  emissiveAnimation?: string;
  emissiveAnimationSpeed?: number;
  blendTextureSet?: string;
  blendMode?: string;
  blendHeight?: number;
  blendSharpness?: number;
}

export interface TexturedMaterialResult {
  material: MeshStandardNodeMaterial;
  timeUniform: any | null;
}

export type UseTexturedMaterialHook = (options: TexturedMaterialOptions | null) => TexturedMaterialResult | null;

// ── Visual block group renderers ──

interface TexturedBlockGroupProps extends BlockGroupProps {
  useTexturedMaterial: UseTexturedMaterialHook;
}

function TexturedBlockGroup({ group, cylinderSegments, lightsNode, tileLightingNode, useTexturedMaterial }: TexturedBlockGroupProps) {
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
  lightsNode: LightsNode | undefined,
  tileLightingNode: TileLightingNode | undefined,
  useTexturedMaterial?: UseTexturedMaterialHook,
) {
  return groups.map((group) => {
    if (group.proceduralMaterial) {
      return <ProceduralBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />;
    }
    if (group.textureSet && useTexturedMaterial) {
      return <TexturedBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} useTexturedMaterial={useTexturedMaterial} />;
    }
    return <FlatBlockGroup key={group.key} group={group} cylinderSegments={cylinderSegments} lightsNode={lightsNode} tileLightingNode={tileLightingNode} />;
  });
}

// ── Main component ──

export interface InstancedBlocksProps {
  blocks: MapBlock[];
  lightsNode?: LightsNode;
  tileLightingNode?: TileLightingNode;
  /** Inject textured material hook from game layer (optional — flat materials used if omitted) */
  useTexturedMaterial?: UseTexturedMaterialHook;
}

export function InstancedBlocks({ blocks, lightsNode, tileLightingNode, useTexturedMaterial }: InstancedBlocksProps) {
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
      {renderGroups(nearGroups, LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL, lightsNode, tileLightingNode, useTexturedMaterial)}
      {renderGroups(farGroups, LOD_GEOMETRY.CYLINDER_SEGMENTS_SIMPLE, lightsNode, tileLightingNode, useTexturedMaterial)}
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
