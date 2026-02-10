import { useMemo } from 'react';
import { RigidBody, HeightfieldCollider } from '@react-three/rapier';
import { createHeightmapGeometry } from './heightmapGeometry';
import type { HeightmapTerrainData } from '../types/map';

const DEFAULTS = {
  color: '#5a7a3a',
  roughness: 0.85,
  metalness: 0.05,
} as const;

/**
 * Flatten 2D heights into column-major Float32Array for Rapier's heightfield.
 * Rapier expects heights in column-major order: iterate columns first, then rows.
 */
function toColumnMajorHeights(heights: number[][]): Float32Array {
  const rows = heights.length;
  const cols = heights[0].length;
  const flat = new Float32Array(rows * cols);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      flat[c * rows + r] = heights[r][c];
    }
  }
  return flat;
}

export interface HeightmapTerrainProps {
  data: HeightmapTerrainData;
}

export function HeightmapTerrain({ data }: HeightmapTerrainProps) {
  const geometry = useMemo(
    () => createHeightmapGeometry(data.heights, data.size[0], data.size[1]),
    [data.heights, data.size],
  );

  const heightfieldArgs = useMemo(() => {
    const rows = data.heights.length;
    const cols = data.heights[0].length;
    const flatHeights = toColumnMajorHeights(data.heights);
    // HeightfieldCollider args: [nrows, ncols, heights, scale]
    // nrows/ncols = subdivisions (rows-1, cols-1 in Rapier convention)
    // scale maps the unit heightfield to world dimensions
    return [
      rows - 1,
      cols - 1,
      flatHeights,
      { x: data.size[0], y: 1, z: data.size[1] },
    ] as const;
  }, [data.heights, data.size]);

  return (
    <RigidBody type="fixed" colliders={false}>
      <HeightfieldCollider
        args={heightfieldArgs as unknown as [number, number, number[], { x: number; y: number; z: number }]}
        position={data.position}
      />
      <mesh
        geometry={geometry}
        position={data.position}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={data.color ?? DEFAULTS.color}
          roughness={data.roughness ?? DEFAULTS.roughness}
          metalness={data.metalness ?? DEFAULTS.metalness}
        />
      </mesh>
    </RigidBody>
  );
}
