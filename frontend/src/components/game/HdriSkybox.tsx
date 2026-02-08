import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three/webgpu';
import type { DataTexture, WebGPURenderer } from 'three/webgpu';
import { loadHDRI } from '../../services/assetManager';
import { devLog } from '../../stores/devLogStore';

interface HdriSkyboxProps {
  /** HDRI filename in /assets/hdri/ (e.g. "satara_night_2k.hdr") */
  filename: string;
}

/**
 * Loads an HDRI .hdr file and sets it as scene.background + scene.environment.
 * Falls back gracefully (no background change) if loading fails.
 */
export function HdriSkybox({ filename }: HdriSkyboxProps) {
  const { scene, gl } = useThree();

  useEffect(() => {
    let disposed = false;
    let envMap: ReturnType<PMREMGenerator['fromEquirectangular']> | null = null;

    loadHDRI(filename)
      .then((hdri: DataTexture) => {
        if (disposed) return;

        const pmrem = new PMREMGenerator(gl as unknown as WebGPURenderer);
        envMap = pmrem.fromEquirectangular(hdri);

        scene.background = envMap.texture;
        scene.environment = envMap.texture;

        pmrem.dispose();
      })
      .catch((err) => {
        devLog.error('HdriSkybox', `Failed to load ${filename}: ${err instanceof Error ? err.message : String(err)}`);
      });

    return () => {
      disposed = true;
      if (envMap) {
        envMap.dispose();
      }
      scene.background = null;
      scene.environment = null;
    };
  }, [filename, scene, gl]);

  return null;
}
