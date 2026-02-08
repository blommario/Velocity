/**
 * lightMaterial.ts — Helper for applying clustered lighting to materials.
 *
 * In the WebGPU path, MeshStandardMaterial = MeshStandardNodeMaterial
 * which has a `lightsNode` property for selective per-material lighting.
 *
 * Engine-level: no game store imports.
 */

import type { MeshStandardMaterial } from 'three/webgpu';
import type { LightsNode } from 'three/webgpu';

/**
 * Apply a LightsNode to a material. The material will only be affected
 * by the lights in the LightsNode (not scene-wide lights).
 *
 * Safe cast: MeshStandardMaterial in WebGPU extends NodeMaterial which
 * has a lightsNode property.
 */
export function applyClusteredLighting(
  material: MeshStandardMaterial,
  lightsNode: LightsNode,
): void {
  // NodeMaterial.lightsNode — typed via @types/three
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
