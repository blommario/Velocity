import type { Object3D, BufferGeometry, Material, Texture } from 'three';

/**
 * Recursively traverses a Three.js scene graph and disposes all
 * geometries, materials, and textures. Safe to call multiple times.
 */
export function disposeSceneGraph(obj: Object3D): void {
  obj.traverse((child) => {
    const mesh = child as { geometry?: BufferGeometry; material?: Material | Material[] };

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const mat of mesh.material) {
          disposeMaterialTextures(mat);
          mat.dispose();
        }
      } else {
        disposeMaterialTextures(mesh.material);
        mesh.material.dispose();
      }
    }
  });
}

function disposeMaterialTextures(material: Material): void {
  const mat = material as unknown as Record<string, unknown>;
  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (isTexture(value)) {
      value.dispose();
    }
  }
}

function isTexture(value: unknown): value is Texture {
  return value !== null && typeof value === 'object' && typeof (value as Texture).dispose === 'function' && 'isTexture' in (value as Texture);
}
