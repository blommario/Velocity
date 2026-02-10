/**
 * Loads an HDRI environment map and applies it as both scene background and environment lighting via PMREMGenerator.
 * Depends on: R3F useThree (scene, gl), PMREMGenerator, devLogStore
 * Used by: Map rendering components that use HDRI-based skyboxes and image-based lighting
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three/webgpu';
import type { DataTexture, WebGPURenderer } from 'three/webgpu';
import { devLog } from '../stores/devLogStore';

interface HdriSkyboxProps {
  /** Load function that returns a DataTexture from an HDRI source */
  loadHdri: (filename: string) => Promise<DataTexture>;
  /** HDRI filename/identifier passed to loadHdri */
  filename: string;
}

export function HdriSkybox({ loadHdri, filename }: HdriSkyboxProps) {
  const { scene, gl } = useThree();

  useEffect(() => {
    let disposed = false;
    let envMap: ReturnType<PMREMGenerator['fromEquirectangular']> | null = null;

    loadHdri(filename)
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
  }, [filename, scene, gl, loadHdri]);

  return null;
}
