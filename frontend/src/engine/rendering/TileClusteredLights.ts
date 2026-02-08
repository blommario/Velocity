/**
 * TileClusteredLights.ts — Constants, types, and CPU-side helpers for
 * screen-space tile-based clustered lighting (500+ lights).
 *
 * CPU responsibilities:
 *  1. SpatialGrid pre-filter — cull distant lights O(cells)
 *  2. Pack surviving lights into pre-allocated Float32Arrays
 *
 * The GPU compute shader (tileBinning.ts) then bins these lights into
 * screen-space tiles, and the fragment node (tileLightingNode.ts)
 * evaluates per-pixel PBR lighting from tile-local light lists.
 *
 * Engine-level: no game store imports.
 */

import type { LightData } from './ClusteredLights';
import type { SpatialGrid } from './SpatialGrid';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const TILE_CONFIG = {
  /** Pixel size of each screen tile. */
  TILE_SIZE: 64,
  /** Max lights uploaded to GPU per frame. */
  MAX_LIGHTS: 512,
  /** Max lights evaluated per tile (capped in compute shader). */
  MAX_PER_TILE: 32,
  /** Spatial pre-filter radius (world units) from camera. */
  PRE_FILTER_RADIUS: 120,
  /** How often to re-bin lights (seconds). ~4Hz. */
  UPDATE_INTERVAL: 0.25,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * CPU-side light buffer ready for GPU upload.
 * lightPositions: [x, y, z, radius, ...]  (vec4 × MAX_LIGHTS)
 * lightColors:    [r, g, b, intensity, ...] (vec4 × MAX_LIGHTS)
 */
export interface TileLightBuffer {
  /** Packed vec4 per light: xyz = position, w = cutoff distance. */
  lightPositions: Float32Array;
  /** Packed vec4 per light: rgb = color (linear), w = intensity. */
  lightColors: Float32Array;
  /** Number of active lights written this frame. */
  lightCount: number;
}

// ---------------------------------------------------------------------------
// Pre-allocated buffers (zero GC at runtime)
// ---------------------------------------------------------------------------

const _positions = new Float32Array(TILE_CONFIG.MAX_LIGHTS * 4);
const _colors = new Float32Array(TILE_CONFIG.MAX_LIGHTS * 4);

/** Reusable result — callers must consume before next call. */
const _buffer: TileLightBuffer = {
  lightPositions: _positions,
  lightColors: _colors,
  lightCount: 0,
};

// ---------------------------------------------------------------------------
// Hex color → linear RGB (pre-allocated scratch)
// ---------------------------------------------------------------------------

function hexToLinear(hex: string, out: Float32Array, offset: number): void {
  // Parse #rrggbb
  const raw = parseInt(hex.charAt(0) === '#' ? hex.slice(1) : hex, 16);
  // sRGB → linear (approximate gamma 2.2)
  const r = ((raw >> 16) & 0xff) / 255;
  const g = ((raw >> 8) & 0xff) / 255;
  const b = (raw & 0xff) / 255;
  out[offset] = r * r; // approximate sRGB→linear
  out[offset + 1] = g * g;
  out[offset + 2] = b * b;
}

// ---------------------------------------------------------------------------
// Build light buffer with SpatialGrid pre-filter
// ---------------------------------------------------------------------------

/**
 * Pre-filter lights via SpatialGrid, then pack into GPU-ready Float32Arrays.
 *
 * @returns A shared `TileLightBuffer` — consume before calling again.
 */
export function buildLightBuffer(
  allLights: readonly LightData[],
  grid: SpatialGrid<number> | null,
  camX: number,
  camZ: number,
  preFilterRadius: number = TILE_CONFIG.PRE_FILTER_RADIUS,
): TileLightBuffer {
  let count = 0;
  const max = TILE_CONFIG.MAX_LIGHTS;

  if (grid && allLights.length > max) {
    // SpatialGrid pre-filter — O(cells in radius)
    const nearIndices = grid.querySphere(camX, camZ, preFilterRadius);
    for (let n = 0; n < nearIndices.length && count < max; n++) {
      const idx = nearIndices[n];
      const ld = allLights[idx];
      packLight(ld, count);
      count++;
    }
  } else {
    // Small light count — pack all directly
    const n = Math.min(allLights.length, max);
    for (let i = 0; i < n; i++) {
      packLight(allLights[i], i);
      count++;
    }
  }

  _buffer.lightCount = count;
  return _buffer;
}

function packLight(ld: LightData, slot: number): void {
  const pOff = slot * 4;
  _positions[pOff] = ld.position[0];
  _positions[pOff + 1] = ld.position[1];
  _positions[pOff + 2] = ld.position[2];
  _positions[pOff + 3] = ld.distance; // cutoff radius

  hexToLinear(ld.color, _colors, slot * 4);
  _colors[slot * 4 + 3] = ld.intensity;
}

// ---------------------------------------------------------------------------
// Tile grid dimensions from viewport size
// ---------------------------------------------------------------------------

export function tileGridSize(
  viewportWidth: number,
  viewportHeight: number,
): { cols: number; rows: number; total: number } {
  const cols = Math.ceil(viewportWidth / TILE_CONFIG.TILE_SIZE);
  const rows = Math.ceil(viewportHeight / TILE_CONFIG.TILE_SIZE);
  return { cols, rows, total: cols * rows };
}
