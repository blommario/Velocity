/**
 * React hook that bridges FogOfWarGrid to a Three.js DataTexture
 * for use in the post-processing pipeline.
 *
 * Two paths:
 *   CPU path (default): distance-based reveal → R8 DataTexture
 *   GPU path (heightmapEnabled + blocks): compute shader DDA ray march →
 *     instancedArray storage buffer read directly in post-processing
 *
 * Updates at ~4Hz. Engine-level: no game store imports.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  DataTexture, RedFormat, UnsignedByteType,
  LinearFilter, ClampToEdgeWrapping,
} from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';
import { FogOfWarGrid, FOG_DEFAULTS, type FogOfWarConfig } from './FogOfWar';
import { buildHeightmap, fogConfigToHeightmapConfig } from './FogOfWarHeightmap';
import { createFogComputeResources, type FogComputeResources, type FogGridConfig } from './fogOfWarCompute';
import type { MapBlock } from '../types/map';
import { devLog } from '../stores/devLogStore';

/** Update interval in seconds (~4Hz). */
const UPDATE_INTERVAL = 0.25;

export interface UseFogOfWarProps {
  /** Enable/disable fog of war. Default true. */
  enabled?: boolean;
  /** Grid configuration overrides. */
  config?: Partial<FogOfWarConfig>;
  /** Viewer world position [x, y, z]. Y used for ray height in GPU path. */
  viewPosition: readonly [number, number, number];
  /** Map blocks for heightmap generation. Required when heightmapEnabled=true. */
  blocks?: ReadonlyArray<MapBlock>;
}

export interface FogOfWarResult {
  /** R8 DataTexture (gridSize × gridSize) for CPU-path post-processing. Null if GPU path or disabled. */
  fogTexture: DataTexture | null;
  /** GPU visibility storage buffer for GPU-path post-processing. Null if CPU path or disabled. */
  fogComputeResources: FogComputeResources | null;
  /** Grid uniforms needed by the post-processing shader. */
  fogUniforms: FogOfWarUniforms | null;
  /** Direct access to the CPU grid for game-level queries. Null if disabled. */
  fogGrid: FogOfWarGrid | null;
  /** Whether the GPU compute path is active. */
  isGpuPath: boolean;
  /** Reset all visibility to HIDDEN. */
  reset: () => void;
}

export interface FogOfWarUniforms {
  gridSize: number;
  cellWorldSize: number;
  originX: number;
  originZ: number;
}

export function useFogOfWar({
  enabled = true,
  config,
  viewPosition,
  blocks,
}: UseFogOfWarProps): FogOfWarResult {
  const { gl } = useThree();
  const renderer = gl as unknown as WebGPURenderer;

  const merged = useMemo(() => ({ ...FOG_DEFAULTS, ...config }), [config]);
  const isGpuPath = enabled && !!merged.heightmapEnabled && !!blocks && blocks.length > 0;

  // ── CPU path refs ──
  const gridRef = useRef<FogOfWarGrid | null>(null);
  const textureRef = useRef<DataTexture | null>(null);
  const uniformsRef = useRef<FogOfWarUniforms | null>(null);

  // ── GPU path refs ──
  const gpuResourcesRef = useRef<FogComputeResources | null>(null);

  // ── Shared refs ──
  const timerRef = useRef(0);

  // ── CPU path: create/destroy grid + texture ──
  useEffect(() => {
    if (!enabled || isGpuPath) {
      gridRef.current = null;
      textureRef.current?.dispose();
      textureRef.current = null;
      uniformsRef.current = null;
      return;
    }

    const grid = new FogOfWarGrid(merged);
    gridRef.current = grid;

    const tex = new DataTexture(
      grid.grid,
      grid.gridSize,
      grid.gridSize,
      RedFormat,
      UnsignedByteType,
    );
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    tex.needsUpdate = true;
    textureRef.current = tex;

    uniformsRef.current = {
      gridSize: grid.gridSize,
      cellWorldSize: grid.cellWorldSize,
      originX: grid.originX,
      originZ: grid.originZ,
    };

    devLog.success('FogOfWar', `CPU path: ${grid.gridSize}×${grid.gridSize} (${grid.gridSize * grid.cellWorldSize}u)`);

    return () => {
      tex.dispose();
      textureRef.current = null;
      gridRef.current = null;
      uniformsRef.current = null;
    };
  }, [enabled, isGpuPath, merged]);

  // ── GPU path: build heightmap + create compute resources ──
  useEffect(() => {
    if (!isGpuPath || !blocks) {
      gpuResourcesRef.current = null;
      return;
    }

    const hmConfig = fogConfigToHeightmapConfig(merged);
    const heightmapData = buildHeightmap(blocks, hmConfig);
    const resources = createFogComputeResources(merged, heightmapData);
    gpuResourcesRef.current = resources;

    // Also keep a CPU grid for getCell() game-logic queries
    const grid = new FogOfWarGrid(merged);
    gridRef.current = grid;
    uniformsRef.current = {
      gridSize: merged.gridSize,
      cellWorldSize: merged.cellWorldSize,
      originX: merged.originX,
      originZ: merged.originZ,
    };

    devLog.success('FogOfWar', `GPU path: ${merged.gridSize}×${merged.gridSize} ray march (${resources.totalCells} cells)`);

    // Async warmup: compile compute pipeline
    const warmup = async () => {
      try {
        await renderer.computeAsync(resources.computeRayMarch);
        devLog.success('FogOfWar', 'Compute pipeline compiled');
      } catch (err) {
        devLog.error('FogOfWar', `Compute warmup failed: ${err}`);
      }
    };
    warmup();

    return () => {
      gpuResourcesRef.current = null;
      gridRef.current = null;
      uniformsRef.current = null;
    };
  }, [isGpuPath, blocks, merged, renderer]);

  // ── Per-frame update (~4Hz) ──
  useFrame((_, delta) => {
    if (!enabled) return;

    timerRef.current += delta;
    if (timerRef.current < UPDATE_INTERVAL) return;
    timerRef.current = 0;

    const [vx, vy, vz] = viewPosition;

    if (isGpuPath) {
      // GPU path: update uniforms + dispatch compute
      const resources = gpuResourcesRef.current;
      if (!resources) return;

      resources.uniforms.viewerX.value = vx;
      resources.uniforms.viewerY.value = vy;
      resources.uniforms.viewerZ.value = vz;

      try {
        renderer.compute(resources.computeRayMarch);
      } catch (err) {
        devLog.error('FogOfWar', `Compute dispatch failed: ${err}`);
      }

      // Also update CPU grid (distance-based, for game queries)
      gridRef.current?.update(vx, vz);
    } else {
      // CPU path: update grid + flag texture
      const grid = gridRef.current;
      const tex = textureRef.current;
      if (!grid || !tex) return;

      grid.update(vx, vz);
      tex.needsUpdate = true;
    }
  });

  const reset = useCallback(() => {
    gridRef.current?.reset();
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
    // GPU visibility buffer resets on next compute dispatch via the "outside totalRadius" logic
  }, []);

  return {
    fogTexture: !isGpuPath ? textureRef.current : null,
    fogComputeResources: isGpuPath ? gpuResourcesRef.current : null,
    fogUniforms: uniformsRef.current,
    fogGrid: gridRef.current,
    isGpuPath,
    reset,
  };
}
