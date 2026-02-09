/**
 * proceduralMaterials.ts — GPU-generated PBR material presets via TSL.
 *
 * Architecture:
 *  - Node builders (getPresetNodes) return raw TSL PBR nodes, no material created.
 *  - Material factory (createProceduralMaterial) handles blending internally,
 *    creates one material per unique config, and caches by full key including blend params.
 *  - Time uniform uses absolute elapsed time (set externally via clock.elapsedTime)
 *    so sharing across multiple useFrame calls is safe.
 *
 * Engine-level: no game store imports.
 */

import {
  float, vec3, uniform, sin, step, pow, hash, floor, fract, mix, clamp,
  positionWorld,
} from 'three/tsl';
import type { ShaderNodeObject, Node, UniformNode } from 'three/tsl';
import { MeshStandardNodeMaterial, Color as ThreeColor } from 'three/webgpu';
import type { ProceduralMaterialType, EmissiveAnimation, BlendMode } from '../types/map';
import { valueNoise2D, fbm2D } from './tslNoise';
import { createBlendFactorNode, blendPbrNodes } from './textureBlendNode';

// ── Types ──

export interface PbrPresetNodes {
  colorNode: ShaderNodeObject<Node>;
  roughnessNode: ShaderNodeObject<Node>;
  metalnessNode: ShaderNodeObject<Node>;
}

export interface ProceduralMaterialConfig {
  type: ProceduralMaterialType;
  color?: string;
  roughnessOverride?: number;
  metalnessOverride?: number;
  emissive?: string;
  emissiveIntensity?: number;
  emissiveAnimation?: EmissiveAnimation;
  emissiveAnimationSpeed?: number;
  scaleX?: number;
  scaleY?: number;
  blendType?: ProceduralMaterialType;
  blendMode?: BlendMode;
  blendHeight?: number;
  blendSharpness?: number;
}

export interface ProceduralMaterialResult {
  material: MeshStandardNodeMaterial;
  timeUniform: UniformNode<number> | null;
}

// ── Emissive animation ──

export function buildEmissiveAnimationNode(
  animation: EmissiveAnimation,
  speed: number,
  timeU: UniformNode<number>,
): ShaderNodeObject<Node> | null {
  const t = timeU.mul(speed);
  switch (animation) {
    case 'pulse': return sin(t).mul(0.5).add(0.5);
    case 'flicker': return step(float(0.5), hash(floor(t.mul(10.0))));
    case 'breathe': return pow(sin(t.mul(0.5)), float(2.0));
    default: return null;
  }
}

// ── Node builders (no material, just TSL nodes) ──

export function getPresetNodes(
  type: ProceduralMaterialType,
  baseColor: ThreeColor,
  sx: number,
  _sy: number,
): PbrPresetNodes {
  switch (type) {
    case 'concrete': return concreteNodes(baseColor, sx);
    case 'metal': return metalNodes(baseColor, sx);
    case 'scifi-panel': return scifiPanelNodes(baseColor, sx);
    case 'neon': return neonNodes(baseColor);
    case 'rust': return rustNodes(baseColor, sx);
    case 'tile': return tileNodes(baseColor, sx);
  }
}

function concreteNodes(c: ThreeColor, sx: number): PbrPresetNodes {
  const n = fbm2D(positionWorld.xz.mul(float(sx)));
  return {
    colorNode: vec3(c.r, c.g, c.b).mul(n.mul(0.3).add(0.7)),
    roughnessNode: n.mul(0.2).add(0.7),
    metalnessNode: float(0.0),
  };
}

function metalNodes(c: ThreeColor, sx: number): PbrPresetNodes {
  const n = valueNoise2D(positionWorld.xz.mul(float(sx)).mul(4.0));
  return {
    colorNode: vec3(c.r, c.g, c.b).mul(n.mul(0.15).add(0.85)),
    roughnessNode: n.mul(0.2).add(0.2),
    metalnessNode: float(0.9),
  };
}

function scifiPanelNodes(c: ThreeColor, sx: number): PbrPresetNodes {
  const grid = fract(positionWorld.xz.mul(float(sx)));
  const edgeX = step(grid.x, float(0.05)).add(step(float(0.95), grid.x));
  const edgeY = step(grid.y, float(0.05)).add(step(float(0.95), grid.y));
  const edge = clamp(edgeX.add(edgeY), float(0.0), float(1.0));
  return {
    colorNode: vec3(c.r, c.g, c.b).mul(edge.mul(-0.3).add(1.0)),
    roughnessNode: mix(float(0.3), float(0.7), edge),
    metalnessNode: float(0.2),
  };
}

function neonNodes(c: ThreeColor): PbrPresetNodes {
  return {
    colorNode: vec3(c.r, c.g, c.b),
    roughnessNode: float(0.1),
    metalnessNode: float(0.0),
  };
}

function rustNodes(c: ThreeColor, sx: number): PbrPresetNodes {
  const n = fbm2D(positionWorld.xz.mul(float(sx)));
  const rustMask = clamp(n.mul(2.5).sub(0.8), float(0.0), float(1.0));
  return {
    colorNode: mix(vec3(c.r, c.g, c.b).mul(0.9), vec3(0.45, 0.22, 0.08), rustMask),
    roughnessNode: mix(float(0.3), float(0.85), rustMask),
    metalnessNode: mix(float(0.9), float(0.0), rustMask),
  };
}

function tileNodes(c: ThreeColor, sx: number): PbrPresetNodes {
  const scaled = positionWorld.xz.mul(float(sx));
  const tileId = floor(scaled);
  const f = fract(scaled);
  const groutX = step(f.x, float(0.04)).add(step(float(0.96), f.x));
  const groutY = step(f.y, float(0.04)).add(step(float(0.96), f.y));
  const grout = clamp(groutX.add(groutY), float(0.0), float(1.0));
  const tileHash = hash(tileId);
  return {
    colorNode: mix(vec3(c.r, c.g, c.b).mul(tileHash.mul(0.15).add(0.85)), vec3(0.2, 0.2, 0.2), grout),
    roughnessNode: mix(float(0.5), float(0.9), grout),
    metalnessNode: float(0.0),
  };
}

// ── Cache ──

const materialCache = new Map<string, ProceduralMaterialResult>();

function cacheKey(config: ProceduralMaterialConfig): string {
  return [
    config.type, config.color ?? '', config.roughnessOverride ?? '',
    config.metalnessOverride ?? '', config.emissive ?? '', config.emissiveIntensity ?? '',
    config.emissiveAnimation ?? '', config.emissiveAnimationSpeed ?? '',
    config.scaleX ?? '', config.scaleY ?? '',
    config.blendType ?? '', config.blendMode ?? '',
    config.blendHeight ?? '', config.blendSharpness ?? '',
  ].join('|');
}

// ── Main factory ──

export function createProceduralMaterial(config: ProceduralMaterialConfig): ProceduralMaterialResult {
  const key = cacheKey(config);
  const cached = materialCache.get(key);
  if (cached) return cached;

  const baseColor = new ThreeColor(config.color || '#888888');
  const sx = config.scaleX ?? 1.0;
  const sy = config.scaleY ?? 1.0;

  // 1. Generate base nodes
  let nodes = getPresetNodes(config.type, baseColor, sx, sy);

  // 2. Apply blending if configured (before material creation — no mutation)
  if (config.blendType && config.blendMode) {
    const blendNodes = getPresetNodes(config.blendType, baseColor, sx, sy);
    const factor = createBlendFactorNode({
      mode: config.blendMode,
      height: config.blendHeight,
      sharpness: config.blendSharpness,
    });
    nodes = blendPbrNodes(nodes, blendNodes, factor);
  }

  // 3. Create material once with final nodes
  const mat = new MeshStandardNodeMaterial();
  mat.colorNode = nodes.colorNode;
  mat.roughnessNode = config.roughnessOverride !== undefined
    ? float(config.roughnessOverride) : nodes.roughnessNode;
  mat.metalnessNode = config.metalnessOverride !== undefined
    ? float(config.metalnessOverride) : nodes.metalnessNode;

  // 4. Emissive + animation
  let timeUniform: UniformNode<number> | null = null;
  const emissiveColor = new ThreeColor(config.emissive || '#000000');
  const intensity = config.emissiveIntensity ?? (config.type === 'neon' ? 4.0 : 0.0);

  if (intensity > 0) {
    const emVec = vec3(emissiveColor.r, emissiveColor.g, emissiveColor.b).mul(intensity);
    const anim = config.emissiveAnimation ?? 'none';
    if (anim !== 'none') {
      timeUniform = uniform(0.0);
      const animNode = buildEmissiveAnimationNode(anim, config.emissiveAnimationSpeed ?? 1.0, timeUniform);
      mat.emissiveNode = animNode ? emVec.mul(animNode) : emVec;
    } else {
      mat.emissiveNode = emVec;
    }
  }

  const result: ProceduralMaterialResult = { material: mat, timeUniform };
  materialCache.set(key, result);
  return result;
}

export function disposeProceduralMaterials(): void {
  for (const { material } of materialCache.values()) {
    material.dispose();
  }
  materialCache.clear();
}
