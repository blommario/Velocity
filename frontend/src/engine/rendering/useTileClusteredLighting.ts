/**
 * useTileClusteredLighting.ts — React hook for tile-based clustered lighting.
 *
 * Orchestrates:
 *  1. SpatialGrid construction from light data (once per map)
 *  2. CPU pre-filter via buildLightBuffer (~4Hz)
 *  3. GPU compute: clear + bin (via renderer.compute)
 *  4. Exposes a tileLightingNode for material composition
 *
 * Falls back to the existing useClusteredLighting when light count is low.
 *
 * Engine-level: no game store imports.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';
import type { LightData } from './ClusteredLights';
import { CLUSTERED_DEFAULTS, type ClusteredLightsConfig } from './ClusteredLights';
import { SpatialGrid } from './SpatialGrid';
import { TILE_CONFIG, buildLightBuffer, tileGridSize } from './TileClusteredLights';
import { createTileBinningResources, type TileBinningResources } from './tileBinning';
import { createTileLightingNode, createTileDebugNode, type TileLightingNode, type TileDebugNode } from './tileLightingNode';
import { devLog } from '../stores/devLogStore';

// ---------------------------------------------------------------------------
// Threshold: below this, use the simple PointLight pool (Steg 1)
// ---------------------------------------------------------------------------

/** Light count at which tile clustering activates. */
const TILE_CLUSTERING_THRESHOLD = 64;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseTileClusteredLightingProps {
  /** All dynamic lights in the scene. */
  lights: readonly LightData[];
  /** Optional config overrides. */
  config?: Partial<ClusteredLightsConfig>;
}

export interface TileClusteredLightingResult {
  /** TSL vec3 node: tile-clustered point light irradiance. null if below threshold. */
  tileLightingNode: TileLightingNode | null;
  /** TSL vec3 node: tile heatmap debug overlay. null if below threshold. */
  tileDebugNode: TileDebugNode | null;
  /** True if the tile-based system is active (light count >= threshold). */
  isTileClustered: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTileClusteredLighting({
  lights: lightData,
  config,
}: UseTileClusteredLightingProps): TileClusteredLightingResult {
  const { gl, size } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const updateInterval = config?.updateInterval ?? CLUSTERED_DEFAULTS.updateInterval;

  // Guard: tile clustering requires WebGPU renderer with compute support
  const isWebGPU = 'compute' in renderer && typeof renderer.compute === 'function';

  // Determine if tile clustering should be active
  const isTileClustered = isWebGPU && lightData.length >= TILE_CLUSTERING_THRESHOLD;

  // Build spatial grid from light positions (rebuilt when lights change)
  const grid = useMemo(() => {
    if (!isTileClustered) return null;
    const g = new SpatialGrid<number>({ cellSize: 32 });
    for (let i = 0; i < lightData.length; i++) {
      const pos = lightData[i].position;
      g.insert(pos[0], pos[2], i);
    }
    return g;
  }, [lightData, isTileClustered]);

  // Calculate tile grid dimensions from viewport
  const { cols, rows, total: maxTiles } = useMemo(
    () => tileGridSize(size.width, size.height),
    [size.width, size.height],
  );

  // Create GPU resources (once, or when tile grid size changes significantly)
  const resourcesRef = useRef<TileBinningResources | null>(null);
  const lightingNodeRef = useRef<TileLightingNode | null>(null);
  const debugNodeRef = useRef<TileDebugNode | null>(null);

  // readyRef MUST be defined before useMemo so it can be reset synchronously
  // when resources are recreated (e.g. on resize). This prevents useFrame from
  // dispatching compute on uncompiled pipelines in the gap between useMemo and useEffect.
  const readyRef = useRef(false);

  const resources = useMemo(() => {
    if (!isTileClustered) return null;

    // Immediately mark not-ready — new resources need warmup before dispatch
    readyRef.current = false;

    const res = createTileBinningResources(maxTiles);
    resourcesRef.current = res;

    // Create the fragment lighting node + debug heatmap node
    const node = createTileLightingNode(res);
    lightingNodeRef.current = node;
    debugNodeRef.current = createTileDebugNode(res);

    devLog.info('Lighting', `Tile clustered: ${cols}×${rows} tiles, max ${TILE_CONFIG.MAX_LIGHTS} lights, ${TILE_CONFIG.MAX_PER_TILE}/tile`);
    return res;
  }, [isTileClustered, maxTiles, cols, rows]);

  // Async warmup: compile compute pipelines — readyRef gates useFrame dispatch.
  // Also serves as cleanup for old GPU resources when resources change (e.g. resize).
  useEffect(() => {
    if (!resources) {
      readyRef.current = false;
      return;
    }
    const warmup = async () => {
      try {
        await renderer.computeAsync(resources.computeClear);
        readyRef.current = true;
        devLog.success('Lighting', 'Tile binning compute pipelines compiled');
      } catch (err) {
        devLog.error('Lighting', `Tile binning warmup failed: ${err}`);
      }
    };
    warmup();

    // Cleanup: mark not-ready and dispose GPU buffers when resources are replaced
    return () => {
      readyRef.current = false;
      // Storage buffers from attributeArray/instancedArray are managed by Three.js
      // and will be garbage-collected when no longer referenced.
      devLog.info('Lighting', 'Tile clustering resources released');
    };
  }, [renderer, resources]);

  // Refs for per-frame data
  const timerRef = useRef(0);
  const lightDataRef = useRef(lightData);
  lightDataRef.current = lightData;

  // Per-frame: data upload at ~4Hz, view matrix + compute binning EVERY frame
  useFrame(({ camera }, delta) => {
    if (!resources || !isTileClustered || !readyRef.current) return;

    // 1. Data upload (positions/colors) — slow path, ~4Hz
    timerRef.current += delta;
    if (timerRef.current >= updateInterval) {
      timerRef.current = timerRef.current > updateInterval * 2 ? 0 : timerRef.current - updateInterval;

      const data = lightDataRef.current;
      if (data.length > 0) {
        const buf = buildLightBuffer(
          data, grid,
          camera.position.x, camera.position.z,
          TILE_CONFIG.PRE_FILTER_RADIUS,
        );

        const posArray = resources.lightPositions.value.array as Float32Array;
        const colArray = resources.lightColors.value.array as Float32Array;
        posArray.set(buf.lightPositions.subarray(0, buf.lightCount * 4));
        colArray.set(buf.lightColors.subarray(0, buf.lightCount * 4));
        resources.lightPositions.value.needsUpdate = true;
        resources.lightColors.value.needsUpdate = true;

        resources.uniforms.lightCount.value = buf.lightCount;
        devLog.info('Lighting', `Tile upload: ${buf.lightCount}/${data.length} lights (pre-filter r=${TILE_CONFIG.PRE_FILTER_RADIUS}), grid ${cols}×${rows}`);
      }
    }

    // 2. View uniforms — MUST update every frame to avoid light lag on camera rotation
    const unis = resources.uniforms;
    unis.viewMatrix.value.copy(camera.matrixWorldInverse);
    unis.projMatrix.value.copy(camera.projectionMatrix);
    unis.tileCols.value = cols;
    unis.tileRows.value = rows;
    unis.viewportWidth.value = size.width;
    unis.viewportHeight.value = size.height;

    // 3. GPU compute: clear + bin — runs every frame (cheap for GPU)
    try {
      renderer.compute(resources.computeClear);
      renderer.compute(resources.computeBin);
    } catch (err) {
      devLog.error('Lighting', `Tile binning compute error: ${err}`);
    }
  });

  return {
    tileLightingNode: isTileClustered ? lightingNodeRef.current : null,
    tileDebugNode: isTileClustered ? debugNodeRef.current : null,
    isTileClustered,
  };
}
