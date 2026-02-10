/**
 * lightMaterial.ts — Helpers for applying clustered lighting to materials.
 *
 * Supports two lighting modes:
 *  1. LightsNode pool (Steg 1) — global top-N PointLights, <64 lights
 *  2. Tile lighting node (Steg 2) — screen-space tile clustering, 500+ lights
 *
 * In the WebGPU path, MeshStandardMaterial = MeshStandardNodeMaterial
 * which has lightsNode + colorNode properties for selective lighting.
 *
 * Engine-level: no game store imports.
 */

import type { MeshStandardMaterial } from 'three/webgpu';
import type { LightsNode } from 'three/webgpu';
import type { TileLightingNode } from './tileLightingNode';

// ---------------------------------------------------------------------------
// Steg 1: LightsNode pool (existing)
// ---------------------------------------------------------------------------

/**
 * Apply a LightsNode to a material. The material will only be affected
 * by the lights in the LightsNode (not scene-wide lights).
 */
export function applyClusteredLighting(
  material: MeshStandardMaterial,
  lightsNode: LightsNode,
): void {
  const nodeMat = material as MeshStandardMaterial & { lightsNode: LightsNode | null };
  nodeMat.lightsNode = lightsNode;
}

/**
 * Remove clustered lighting from a material, reverting to default
 * scene-wide lighting behavior.
 */
export function removeClusteredLighting(
  material: MeshStandardMaterial,
): void {
  const nodeMat = material as MeshStandardMaterial & { lightsNode: LightsNode | null };
  nodeMat.lightsNode = null;
}

// ---------------------------------------------------------------------------
// Steg 2: Tile-clustered lighting node
// ---------------------------------------------------------------------------

/**
 * Apply tile-clustered lighting to a material via emissiveNode.
 *
 * Uses emissiveNode (additive) so the material preserves its textures,
 * normal maps, and scene lighting (ambient, directional, IBL). The tile
 * lighting contribution adds on top as additional point light radiance.
 *
 * The tile lighting node reads materialColor, materialRoughness, and
 * materialMetalness internally for energy-conserving PBR.
 */
export function applyTileLighting(
  material: MeshStandardMaterial,
  tileLightingNode: TileLightingNode,
): void {
  const nodeMat = material as MeshStandardMaterial & {
    emissiveNode: unknown;
    _prevEmissiveNode?: unknown;
    _tileLightingApplied?: boolean;
  };

  if (nodeMat._tileLightingApplied) return;

  // Preserve any existing emissiveNode (neon signs, glowing blocks, etc.)
  const originalEmissive = nodeMat.emissiveNode;
  nodeMat._prevEmissiveNode = originalEmissive;

  // Combine: tile lighting + existing emissive (if any)
  if (originalEmissive) {
    // TSL nodes support .add() for additive composition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/three TSL node gap
    nodeMat.emissiveNode = (tileLightingNode as any).add(originalEmissive);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeMat.emissiveNode = tileLightingNode as any;
  }
  nodeMat._tileLightingApplied = true;
}

/**
 * Remove tile-clustered lighting, restoring the material's emissiveNode.
 */
export function removeTileLighting(
  material: MeshStandardMaterial,
): void {
  const nodeMat = material as MeshStandardMaterial & {
    emissiveNode: unknown;
    _prevEmissiveNode?: unknown;
    _tileLightingApplied?: boolean;
  };

  if (!nodeMat._tileLightingApplied) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- restoring saved node reference
  nodeMat.emissiveNode = (nodeMat._prevEmissiveNode ?? null) as any;
  delete nodeMat._prevEmissiveNode;
  delete nodeMat._tileLightingApplied;
}
