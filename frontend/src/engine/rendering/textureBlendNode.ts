/**
 * textureBlendNode.ts — TSL blend factor + PBR node mixing.
 *
 * Creates a blend factor (0..1) based on world-space height or noise,
 * then mixes two sets of PBR nodes (color, roughness, metalness).
 *
 * Engine-level: no game store imports.
 */

import { float, clamp, mix, positionWorld } from 'three/tsl';
import type { ShaderNodeObject, Node } from 'three/tsl';
import type { BlendMode } from '../types/map';
import { fbm2D } from './tslNoise';

export interface TextureBlendConfig {
  mode: BlendMode;
  height?: number;
  sharpness?: number;
}

/**
 * Build a TSL float node (0..1) representing the blend factor.
 * 0 = fully base material, 1 = fully blend material.
 */
export function createBlendFactorNode(config: TextureBlendConfig): ShaderNodeObject<Node> {
  const sharpness = config.sharpness ?? 4.0;

  switch (config.mode) {
    case 'height': {
      const h = config.height ?? 0.0;
      return clamp(positionWorld.y.sub(h).mul(sharpness), float(0.0), float(1.0));
    }
    case 'noise': {
      const n = fbm2D(positionWorld.xz.mul(2.0));
      return clamp(n.mul(sharpness).sub(float(sharpness).mul(0.5)).add(0.5), float(0.0), float(1.0));
    }
    default: {
      const _exhaustive: never = config.mode;
      return float(0.0);
    }
  }
}

export interface PbrNodes {
  colorNode: ShaderNodeObject<Node>;
  roughnessNode: ShaderNodeObject<Node>;
  metalnessNode: ShaderNodeObject<Node>;
}

/**
 * Mix two sets of PBR nodes using the blend factor.
 */
export function blendPbrNodes(
  base: PbrNodes,
  blend: PbrNodes,
  factor: ShaderNodeObject<Node>,
): PbrNodes {
  return {
    colorNode: mix(base.colorNode, blend.colorNode, factor),
    roughnessNode: mix(base.roughnessNode, blend.roughnessNode, factor),
    metalnessNode: mix(base.metalnessNode, blend.metalnessNode, factor),
  };
}
