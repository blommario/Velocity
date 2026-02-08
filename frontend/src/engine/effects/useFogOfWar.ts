/**
 * React hook that bridges FogOfWarGrid to a Three.js DataTexture
 * for use in the post-processing pipeline.
 *
 * Updates at ~4Hz: runs grid.update(), copies Uint8Array → texture.
 * Engine-level: no game store imports. View position via props.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DataTexture, RedFormat, UnsignedByteType,
  NearestFilter, LinearFilter, ClampToEdgeWrapping,
} from 'three/webgpu';
import { FogOfWarGrid, FOG_DEFAULTS, type FogOfWarConfig } from './FogOfWar';
import { devLog } from '../stores/devLogStore';

/** Update interval in seconds (~4Hz). */
const UPDATE_INTERVAL = 0.25;

export interface UseFogOfWarProps {
  /** Enable/disable fog of war. Default true. */
  enabled?: boolean;
  /** Grid configuration overrides. */
  config?: Partial<FogOfWarConfig>;
  /** Viewer world position [x, y, z]. Y is ignored (XZ plane). */
  viewPosition: readonly [number, number, number];
}

export interface FogOfWarResult {
  /** R8 DataTexture (gridSize × gridSize) for post-processing. Null if disabled. */
  fogTexture: DataTexture | null;
  /** Grid uniforms needed by the post-processing shader. */
  fogUniforms: FogOfWarUniforms | null;
  /** Direct access to the grid for game-level queries. Null if disabled. */
  fogGrid: FogOfWarGrid | null;
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
}: UseFogOfWarProps): FogOfWarResult {
  const gridRef = useRef<FogOfWarGrid | null>(null);
  const textureRef = useRef<DataTexture | null>(null);
  const uniformsRef = useRef<FogOfWarUniforms | null>(null);
  const timerRef = useRef(0);

  // Create/destroy grid + texture on mount or config change
  useEffect(() => {
    if (!enabled) {
      gridRef.current = null;
      textureRef.current?.dispose();
      textureRef.current = null;
      uniformsRef.current = null;
      return;
    }

    const merged = { ...FOG_DEFAULTS, ...config };
    const grid = new FogOfWarGrid(merged);
    gridRef.current = grid;

    // R8 texture — single channel, gridSize × gridSize
    const tex = new DataTexture(
      grid.grid,          // shares the same Uint8Array
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

    devLog.success('FogOfWar', `Grid ${grid.gridSize}×${grid.gridSize} (${grid.gridSize * grid.cellWorldSize}u coverage)`);

    return () => {
      tex.dispose();
      textureRef.current = null;
      gridRef.current = null;
      uniformsRef.current = null;
    };
  }, [enabled, config]);

  // ~4Hz update: recompute visibility, flag texture for upload
  useFrame((_, delta) => {
    const grid = gridRef.current;
    const tex = textureRef.current;
    if (!grid || !tex) return;

    timerRef.current += delta;
    if (timerRef.current < UPDATE_INTERVAL) return;
    timerRef.current = 0;

    grid.update(viewPosition[0], viewPosition[2]);
    tex.needsUpdate = true;
  });

  const reset = useCallback(() => {
    gridRef.current?.reset();
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  }, []);

  return {
    fogTexture: textureRef.current,
    fogUniforms: uniformsRef.current,
    fogGrid: gridRef.current,
    reset,
  };
}
