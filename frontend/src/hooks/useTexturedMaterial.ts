import { useEffect, useState } from 'react';
import { MeshStandardNodeMaterial, RepeatWrapping } from 'three/webgpu';
import type { UniformNode } from 'three/tsl';
import { loadTextureSet, type TextureSet } from '../services/assetManager';
import { buildEmissiveAnimationNode } from '../engine/rendering/proceduralMaterials';
import { createBlendFactorNode, blendPbrNodes } from '../engine/rendering/textureBlendNode';
import { devLog } from '../engine/stores/devLogStore';
import { float, vec3, uniform, texture as tslTexture } from 'three/tsl';
import { Color as ThreeColor } from 'three/webgpu';
import type { EmissiveAnimation, BlendMode } from '../engine/types/map';

export interface TexturedMaterialOptions {
  textureSet: string;
  repeatX?: number;
  repeatY?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughnessOverride?: number;
  metalnessOverride?: number;
  emissiveAnimation?: EmissiveAnimation;
  emissiveAnimationSpeed?: number;
  blendTextureSet?: string;
  blendMode?: BlendMode;
  blendHeight?: number;
  blendSharpness?: number;
}

export interface TexturedMaterialResult {
  material: MeshStandardNodeMaterial;
  timeUniform: UniformNode<number> | null;
}

/**
 * Hook that loads a PBR texture set and returns a MeshStandardMaterial.
 * Supports roughness/metalness overrides, emissive animation, and texture blending.
 * Returns null while loading, falls back gracefully on error.
 */
export function useTexturedMaterial(
  options: TexturedMaterialOptions | null,
): TexturedMaterialResult | null {
  const [result, setResult] = useState<TexturedMaterialResult | null>(null);

  useEffect(() => {
    if (!options) {
      setResult(null);
      return;
    }

    let disposed = false;

    const loadPromises: Promise<TextureSet>[] = [loadTextureSet(options.textureSet)];
    if (options.blendTextureSet) {
      loadPromises.push(loadTextureSet(options.blendTextureSet));
    }

    Promise.all(loadPromises)
      .then(([texSet, blendTexSet]) => {
        if (disposed) return;

        const mat = new MeshStandardNodeMaterial();
        const rx = options.repeatX ?? 1;
        const ry = options.repeatY ?? 1;

        const applyRepeat = (tex: typeof texSet.albedo) => {
          tex.wrapS = RepeatWrapping;
          tex.wrapT = RepeatWrapping;
          tex.repeat.set(rx, ry);
        };

        // Base texture set
        applyRepeat(texSet.albedo);
        mat.map = texSet.albedo;

        if (texSet.normal) { applyRepeat(texSet.normal); mat.normalMap = texSet.normal; }
        if (texSet.ao) { applyRepeat(texSet.ao); mat.aoMap = texSet.ao; }

        // Roughness: override or map
        if (options.roughnessOverride !== undefined) {
          mat.roughness = options.roughnessOverride;
        } else if (texSet.roughness) {
          applyRepeat(texSet.roughness);
          mat.roughnessMap = texSet.roughness;
        }

        // Metalness: override or map
        if (options.metalnessOverride !== undefined) {
          mat.metalness = options.metalnessOverride;
        } else if (texSet.metalness) {
          applyRepeat(texSet.metalness);
          mat.metalnessMap = texSet.metalness;
          mat.metalness = 1.0;
        }

        // Emissive map (set on CPU material for non-animated path)
        if (texSet.emissive) {
          applyRepeat(texSet.emissive);
          mat.emissiveMap = texSet.emissive;
          mat.emissiveIntensity = options.emissiveIntensity ?? 1.0;
        }

        if (options.color) mat.color.set(options.color);
        if (options.emissive) mat.emissive.set(options.emissive);
        if (options.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = options.emissiveIntensity;
        }

        // Emissive animation — must sample emissive texture in TSL if present
        let timeUniform: UniformNode<number> | null = null;
        const anim = options.emissiveAnimation ?? 'none';
        if (anim !== 'none' && mat.emissiveIntensity > 0) {
          timeUniform = uniform(0.0);
          const emColor = new ThreeColor(options.emissive || '#ffffff');
          const intensity = options.emissiveIntensity ?? 1.0;
          let emBaseNode = vec3(emColor.r, emColor.g, emColor.b).mul(intensity);
          // Multiply by emissive texture if present (so texture detail is preserved)
          if (texSet.emissive) {
            emBaseNode = emBaseNode.mul(tslTexture(texSet.emissive));
            mat.emissiveMap = null; // TSL node takes over
          }
          const animNode = buildEmissiveAnimationNode(anim, options.emissiveAnimationSpeed ?? 1.0, timeUniform);
          mat.emissiveNode = animNode ? emBaseNode.mul(animNode) : emBaseNode;
        }

        // Texture blending
        if (blendTexSet && options.blendMode) {
          applyRepeat(blendTexSet.albedo);
          const factor = createBlendFactorNode({
            mode: options.blendMode,
            height: options.blendHeight,
            sharpness: options.blendSharpness,
          });

          const baseColor = tslTexture(texSet.albedo);
          const blendColor = tslTexture(blendTexSet.albedo);

          const baseRough = texSet.roughness ? tslTexture(texSet.roughness) : float(0.5);
          const blendRough = blendTexSet.roughness
            ? (applyRepeat(blendTexSet.roughness), tslTexture(blendTexSet.roughness))
            : float(0.5);

          const baseMetal = texSet.metalness ? tslTexture(texSet.metalness) : float(0.0);
          const blendMetal = blendTexSet.metalness
            ? (applyRepeat(blendTexSet.metalness), tslTexture(blendTexSet.metalness))
            : float(0.0);

          const blended = blendPbrNodes(
            { colorNode: baseColor, roughnessNode: baseRough, metalnessNode: baseMetal },
            { colorNode: blendColor, roughnessNode: blendRough, metalnessNode: blendMetal },
            factor,
          );

          mat.colorNode = blended.colorNode;
          mat.roughnessNode = blended.roughnessNode;
          mat.metalnessNode = blended.metalnessNode;
        }

        mat.needsUpdate = true;
        setResult({ material: mat, timeUniform });
      })
      .catch((err) => {
        devLog.error('TextureMat', `Failed to load ${options.textureSet}: ${err instanceof Error ? err.message : String(err)}`);
      });

    return () => {
      disposed = true;
      if (result) result.material.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.textureSet, options?.repeatX, options?.repeatY, options?.blendTextureSet]);

  return result;
}
