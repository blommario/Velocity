import { useEffect, useState } from 'react';
import { MeshStandardMaterial, RepeatWrapping } from 'three/webgpu';
import { loadTextureSet, type TextureSet } from '../services/assetManager';
import { devLog } from '../stores/devLogStore';

interface TexturedMaterialOptions {
  textureSet: string;
  repeatX?: number;
  repeatY?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
}

/**
 * Hook that loads a PBR texture set and returns a MeshStandardMaterial.
 * Returns null while loading, falls back gracefully on error.
 */
export function useTexturedMaterial(
  options: TexturedMaterialOptions | null,
): MeshStandardMaterial | null {
  const [material, setMaterial] = useState<MeshStandardMaterial | null>(null);

  useEffect(() => {
    if (!options) {
      setMaterial(null);
      return;
    }

    let disposed = false;

    loadTextureSet(options.textureSet)
      .then((texSet: TextureSet) => {
        if (disposed) return;

        const mat = new MeshStandardMaterial();

        // Apply texture repeat to all maps
        const rx = options.repeatX ?? 1;
        const ry = options.repeatY ?? 1;

        const applyRepeat = (tex: typeof texSet.albedo) => {
          tex.wrapS = RepeatWrapping;
          tex.wrapT = RepeatWrapping;
          tex.repeat.set(rx, ry);
        };

        applyRepeat(texSet.albedo);
        mat.map = texSet.albedo;

        if (texSet.normal) {
          applyRepeat(texSet.normal);
          mat.normalMap = texSet.normal;
        }
        if (texSet.roughness) {
          applyRepeat(texSet.roughness);
          mat.roughnessMap = texSet.roughness;
        }
        if (texSet.metalness) {
          applyRepeat(texSet.metalness);
          mat.metalnessMap = texSet.metalness;
          mat.metalness = 1.0; // Let map drive value
        }
        if (texSet.ao) {
          applyRepeat(texSet.ao);
          mat.aoMap = texSet.ao;
        }
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

        mat.needsUpdate = true;
        setMaterial(mat);
      })
      .catch((err) => {
        devLog.error('TextureMat', `Failed to load ${options.textureSet}: ${err instanceof Error ? err.message : String(err)}`);
      });

    return () => {
      disposed = true;
      if (material) {
        material.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.textureSet, options?.repeatX, options?.repeatY]);

  return material;
}
