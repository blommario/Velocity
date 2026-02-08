/**
 * tileBinning.ts — GPU compute shader that bins lights into screen-space tiles.
 *
 * Each invocation = 1 light. Projects its sphere to screen space, determines
 * overlapping tiles, and atomically appends the light index to each tile.
 *
 * The fragment shader (tileLightingNode.ts) reads the tile data as read-only
 * storage to evaluate per-pixel PBR lighting.
 *
 * Engine-level: no game store imports.
 */

import { Matrix4 } from 'three';
import {
  Fn, uniform, float, uint, int, vec4, instanceIndex, If, Loop,
  attributeArray, instancedArray,
} from 'three/tsl';
import { atomicAdd } from 'three/tsl';
import { TILE_CONFIG } from './TileClusteredLights';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All GPU resources created once and reused each frame. */
export interface TileBinningResources {
  /** vec4 per light: xyz + cutoff radius. CPU writes via .value.array. */
  lightPositions: ReturnType<typeof attributeArray>;
  /** vec4 per light: rgb linear + intensity. CPU writes via .value.array. */
  lightColors: ReturnType<typeof attributeArray>;
  /** uint per tile — light count per tile. GPU atomic read/write. */
  tileLightCounts: ReturnType<typeof instancedArray>;
  /** uint per (tile × MAX_PER_TILE) — packed light indices. GPU write. */
  tileLightIndices: ReturnType<typeof instancedArray>;

  /** Compute node: zero all tile counts. Dispatch = maxTiles. */
  computeClear: ReturnType<ReturnType<typeof Fn>>;
  /** Compute node: bin lights into tiles. Dispatch = MAX_LIGHTS. */
  computeBin: ReturnType<ReturnType<typeof Fn>>;

  /** CPU-writable uniforms — mutated by the hook each update. */
  uniforms: TileBinningUniforms;

  /** Total allocated tile slots. */
  maxTiles: number;
}

export interface TileBinningUniforms {
  lightCount: { value: number };
  viewMatrix: { value: Matrix4 };
  projMatrix: { value: Matrix4 };
  tileCols: { value: number };
  tileRows: { value: number };
  viewportWidth: { value: number };
  viewportHeight: { value: number };
}

// ---------------------------------------------------------------------------
// Create all GPU resources + compute shaders (called once)
// ---------------------------------------------------------------------------

export function createTileBinningResources(maxTiles: number): TileBinningResources {
  const maxLights = TILE_CONFIG.MAX_LIGHTS;
  const maxPerTile = TILE_CONFIG.MAX_PER_TILE;

  // --- Storage buffers ---
  // Light data: CPU→GPU (written ~4Hz)
  const lightPositions = attributeArray(maxLights, 'vec4');
  const lightColors = attributeArray(maxLights, 'vec4');

  // Tile output: GPU compute writes, GPU fragment reads
  const tileLightCounts = instancedArray(maxTiles, 'uint').toAtomic();
  const tileLightIndices = instancedArray(maxTiles * maxPerTile, 'uint');

  // --- Uniforms ---
  const unis: TileBinningUniforms = {
    lightCount: { value: 0 },
    viewMatrix: { value: new Matrix4() },
    projMatrix: { value: new Matrix4() },
    tileCols: { value: 20 },
    tileRows: { value: 12 },
    viewportWidth: { value: 1280 },
    viewportHeight: { value: 720 },
  };

  const uLightCount = uniform(unis.lightCount, 'uint');
  const uViewMatrix = uniform(unis.viewMatrix, 'mat4');
  const uProjMatrix = uniform(unis.projMatrix, 'mat4');
  const uTileCols = uniform(unis.tileCols, 'uint');
  const uTileRows = uniform(unis.tileRows, 'uint');
  const uViewW = uniform(unis.viewportWidth, 'float');
  const uViewH = uniform(unis.viewportHeight, 'float');
  const uTileSize = float(TILE_CONFIG.TILE_SIZE);
  const uMaxPerTile = uint(maxPerTile);

  // --- Compute pass 1: Clear tile counts to zero ---
  const computeClear = Fn(() => {
    tileLightCounts.element(instanceIndex).assign(uint(0));
  })().compute(maxTiles);

  // --- Compute pass 2: Bin each light into overlapping tiles ---
  const computeBin = Fn(() => {
    const lightIdx = instanceIndex;

    // Skip inactive slots
    If(lightIdx.greaterThanEqual(uLightCount), () => { return; });

    // Read light sphere (world space)
    const posData = lightPositions.element(lightIdx);
    const radius = posData.w;

    // World → view space
    const worldPos = vec4(posData.x, posData.y, posData.z, float(1.0));
    const viewPos = uViewMatrix.mul(worldPos);

    // Cull behind camera (view-space z < 0 is forward)
    If(viewPos.z.greaterThan(radius), () => { return; });

    // View → clip
    const clipPos = uProjMatrix.mul(viewPos);
    const clipW = clipPos.w.max(float(0.001));
    const ndcX = clipPos.x.div(clipW);
    const ndcY = clipPos.y.div(clipW);

    // NDC → screen pixels
    const screenX = ndcX.add(float(1.0)).mul(float(0.5)).mul(uViewW);
    const screenY = float(1.0).sub(ndcY.add(float(1.0)).mul(float(0.5))).mul(uViewH);

    // Approximate screen-space radius: r_px ≈ r_world * f_px / |viewZ|
    // Capped to half the viewport diagonal to prevent explosion when camera is inside light
    const focalPx = uProjMatrix.element(0).element(0).mul(uViewW).mul(float(0.5));
    const absViewZ = viewPos.z.negate().max(float(0.001));
    const maxScreenRadius = uViewW.mul(float(0.5));
    const screenRadius = radius.mul(focalPx).div(absViewZ).min(maxScreenRadius);

    // Determine tile AABB overlap
    const minTX = screenX.sub(screenRadius).div(uTileSize).floor().max(float(0.0)).toInt();
    const maxTX = screenX.add(screenRadius).div(uTileSize).floor().min(uTileCols.sub(uint(1)).toFloat()).toInt();
    const minTY = screenY.sub(screenRadius).div(uTileSize).floor().max(float(0.0)).toInt();
    const maxTY = screenY.add(screenRadius).div(uTileSize).floor().min(uTileRows.sub(uint(1)).toFloat()).toInt();

    // Append light to each overlapping tile
    Loop({ start: minTY, end: maxTY.add(int(1)), type: 'int', condition: '<' }, ({ i: ty }) => {
      Loop({ start: minTX, end: maxTX.add(int(1)), type: 'int', condition: '<' }, ({ i: tx }) => {
        const tileIdx = ty.toUint().mul(uTileCols).add(tx.toUint());
        const slot = atomicAdd(tileLightCounts.element(tileIdx), uint(1));

        // Clamp to max-per-tile budget
        If(slot.lessThan(uMaxPerTile), () => {
          tileLightIndices.element(tileIdx.mul(uMaxPerTile).add(slot)).assign(lightIdx.toUint());
        });
      });
    });
  })().compute(maxLights);

  return {
    lightPositions,
    lightColors,
    tileLightCounts,
    tileLightIndices,
    computeClear,
    computeBin,
    uniforms: unis,
    maxTiles,
  };
}
