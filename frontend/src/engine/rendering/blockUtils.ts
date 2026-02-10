/**
 * blockUtils.ts — Shared utilities for instanced block rendering.
 *
 * Extracted to avoid circular dependency between InstancedBlocks <-> ProceduralBlockGroup.
 */

import { useEffect, useRef, useMemo } from 'react';
import { Object3D, InstancedMesh, Euler, BoxGeometry, CylinderGeometry } from 'three';
import type { LightsNode, MeshStandardMaterial } from 'three/webgpu';
import { LOD_GEOMETRY } from './LodManager';
import { applyTileLighting, removeTileLighting } from './lightMaterial';
import type { TileLightingNode } from './tileLightingNode';
import type { MapBlock, ProceduralMaterialType, EmissiveAnimation, BlendMode } from '../types/map';

// ── Block grouping interface ──

export interface BlockGroup {
  key: string;
  shape: MapBlock['shape'];
  color: string;
  emissive: string;
  emissiveIntensity: number;
  transparent: boolean;
  opacity: number;
  textureSet?: string;
  textureScale?: [number, number];
  roughness?: number;
  metalness?: number;
  proceduralMaterial?: ProceduralMaterialType;
  emissiveAnimation?: EmissiveAnimation;
  emissiveAnimationSpeed?: number;
  blendTextureSet?: string;
  blendProceduralMaterial?: ProceduralMaterialType;
  blendMode?: BlendMode;
  blendHeight?: number;
  blendSharpness?: number;
  blocks: MapBlock[];
}

export interface BlockGroupProps {
  group: BlockGroup;
  cylinderSegments: number;
  lightsNode?: LightsNode;
  tileLightingNode?: TileLightingNode;
}

// ── Shared geometries ──

const _blockEuler = new Euler();
const _boxGeometry = new BoxGeometry(1, 1, 1);
const _cylinderGeometryFull = new CylinderGeometry(0.5, 0.5, 1, LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL);
const _cylinderGeometrySimple = new CylinderGeometry(0.5, 0.5, 1, LOD_GEOMETRY.CYLINDER_SEGMENTS_SIMPLE);

export function getGeometry(shape: MapBlock['shape'], cylinderSegments: number) {
  if (shape === 'cylinder') {
    return cylinderSegments >= LOD_GEOMETRY.CYLINDER_SEGMENTS_FULL
      ? _cylinderGeometryFull
      : _cylinderGeometrySimple;
  }
  return _boxGeometry;
}

// ── Instance matrix hook ──

export function useInstanceMatrix(blocks: MapBlock[]) {
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

// ── Lighting binding hook ──

export function useLightingBinding(
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
