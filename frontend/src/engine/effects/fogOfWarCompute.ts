/**
 * fogOfWarCompute.ts — GPU compute shader for ray-marched fog of war.
 *
 * Each invocation = 1 grid cell. Casts a 2D DDA ray from the viewer to the
 * cell center, checking against a heightmap. If blocked → cell stays hidden.
 * If clear → cell is visible (with distance-based fade at edges).
 *
 * Follows the tileBinning.ts compute pattern:
 *   attributeArray → CPU→GPU heightmap (written once)
 *   instancedArray → GPU visibility output (per-dispatch)
 *
 * Engine-level: no game store imports.
 */

import {
  Fn, uniform, float, uint, int, instanceIndex, If, Loop,
  attributeArray, instancedArray, sqrt, abs, sign, floor, min, max, round,
} from 'three/tsl';
import type { FogOfWarConfig } from './FogOfWar';
import { FOG_DEFAULTS, VisibilityState } from './FogOfWar';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum DDA steps per ray. Enough for diagonal of 128×128 grid. */
const MAX_RAY_STEPS = 192;

/** Small epsilon to avoid division by zero in DDA. */
const DDA_EPSILON = 1e-6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All GPU resources for fog-of-war compute. Created once per map. */
export interface FogComputeResources {
  /** float per cell: max-Y heightmap. CPU writes once via .value.array. */
  heightmapBuffer: ReturnType<typeof attributeArray>;
  /** uint per cell: visibility output (0/128/255). GPU read/write. */
  visibilityBuffer: ReturnType<typeof instancedArray>;
  /** Compute node: ray march all cells. Dispatch = totalCells. */
  computeRayMarch: ReturnType<ReturnType<typeof Fn>>;
  /** CPU-writable uniforms — mutated by the hook each update. */
  uniforms: FogComputeUniforms;
  /** Grid layout config for fragment shader consumption. */
  gridConfig: FogGridConfig;
  /** Total cell count (gridSize²). */
  totalCells: number;
}

export interface FogComputeUniforms {
  viewerX: { value: number };
  viewerY: { value: number };
  viewerZ: { value: number };
  gridSize: { value: number };
  cellWorldSize: { value: number };
  originX: { value: number };
  originZ: { value: number };
  revealRadius: { value: number };
  totalRadius: { value: number };
}

export interface FogGridConfig {
  gridSize: number;
  cellWorldSize: number;
  originX: number;
  originZ: number;
}

// ---------------------------------------------------------------------------
// Resource creation
// ---------------------------------------------------------------------------

export function createFogComputeResources(
  config: FogOfWarConfig,
  heightmapData: Float32Array,
): FogComputeResources {
  const c = { ...FOG_DEFAULTS, ...config };
  const totalCells = c.gridSize * c.gridSize;
  const totalR = c.revealRadius + c.fadeRadius;

  // --- Storage buffers ---
  const heightmapBuffer = attributeArray(totalCells, 'float');
  const visibilityBuffer = instancedArray(totalCells, 'uint');

  // Write heightmap data to GPU buffer (once)
  const hArr = heightmapBuffer.value.array as Float32Array;
  hArr.set(heightmapData);
  heightmapBuffer.value.needsUpdate = true;

  // --- Uniforms ---
  const unis: FogComputeUniforms = {
    viewerX: { value: 0 },
    viewerY: { value: 0 },
    viewerZ: { value: 0 },
    gridSize: { value: c.gridSize },
    cellWorldSize: { value: c.cellWorldSize },
    originX: { value: c.originX },
    originZ: { value: c.originZ },
    revealRadius: { value: c.revealRadius },
    totalRadius: { value: totalR },
  };

  const uViewerX = uniform(unis.viewerX, 'float');
  const uViewerY = uniform(unis.viewerY, 'float');
  const uViewerZ = uniform(unis.viewerZ, 'float');
  const uGridSize = uniform(unis.gridSize, 'uint');
  const uCellWS = uniform(unis.cellWorldSize, 'float');
  const uOriginX = uniform(unis.originX, 'float');
  const uOriginZ = uniform(unis.originZ, 'float');
  const uRevealR = uniform(unis.revealRadius, 'float');
  const uTotalR = uniform(unis.totalRadius, 'float');

  const VISIBLE = uint(VisibilityState.VISIBLE);
  const PREVIOUSLY_SEEN = uint(VisibilityState.PREVIOUSLY_SEEN);

  // --- Compute shader: ray march per cell ---
  const computeRayMarch = Fn(() => {
    const cellIdx = instanceIndex;
    const gs = uGridSize;
    const gsf = gs.toFloat();
    const totalC = gs.mul(gs);

    // Skip out-of-bounds (dispatch may overshoot to workgroup alignment)
    If(cellIdx.greaterThanEqual(totalC), () => { return; });

    // Cell coordinates
    const cellZ = cellIdx.div(gs);
    const cellX = cellIdx.sub(cellZ.mul(gs));
    const cellXf = cellX.toFloat();
    const cellZf = cellZ.toFloat();

    // Cell center in world space
    const cellWorldX = uOriginX.add(cellXf.add(float(0.5)).mul(uCellWS));
    const cellWorldZ = uOriginZ.add(cellZf.add(float(0.5)).mul(uCellWS));

    // Distance from viewer to cell (XZ plane)
    const dx = cellWorldX.sub(uViewerX);
    const dz = cellWorldZ.sub(uViewerZ);
    const distSq = dx.mul(dx).add(dz.mul(dz));
    const dist = sqrt(distSq);

    // Load previous visibility
    const prevVis = visibilityBuffer.element(cellIdx);

    // Outside total radius: downgrade VISIBLE → PREVIOUSLY_SEEN, keep rest
    If(dist.greaterThan(uTotalR), () => {
      If(prevVis.equal(VISIBLE), () => {
        visibilityBuffer.element(cellIdx).assign(PREVIOUSLY_SEEN);
      });
      return;
    });

    // --- 2D DDA ray march: viewer → cell center (in cell coordinates) ---
    const viewCx = uViewerX.sub(uOriginX).div(uCellWS);
    const viewCz = uViewerZ.sub(uOriginZ).div(uCellWS);
    const targetCx = cellXf.add(float(0.5));
    const targetCz = cellZf.add(float(0.5));

    const rayCellDx = targetCx.sub(viewCx);
    const rayCellDz = targetCz.sub(viewCz);
    const rayLen = sqrt(rayCellDx.mul(rayCellDx).add(rayCellDz.mul(rayCellDz)));

    // Viewer is in this cell → always visible
    If(rayLen.lessThan(float(0.5)), () => {
      visibilityBuffer.element(cellIdx).assign(VISIBLE);
      return;
    });

    // DDA direction
    const dirX = rayCellDx.div(rayLen);
    const dirZ = rayCellDz.div(rayLen);

    const stepX = sign(rayCellDx).toInt();
    const stepZ = sign(rayCellDz).toInt();

    // tDelta: how much t to cross one cell
    const absDirX = abs(dirX).max(float(DDA_EPSILON));
    const absDirZ = abs(dirZ).max(float(DDA_EPSILON));
    const tDeltaX = float(1.0).div(absDirX);
    const tDeltaZ = float(1.0).div(absDirZ);

    // Current cell (integer, starts at viewer cell)
    const curX = floor(viewCx).toInt().toVar();
    const curZ = floor(viewCz).toInt().toVar();

    // tMax: t value at which the ray crosses the next cell boundary
    // For positive direction: next boundary = floor(viewCx) + 1
    // For negative direction: next boundary = floor(viewCx)
    const fracX = viewCx.sub(floor(viewCx));
    const fracZ = viewCz.sub(floor(viewCz));

    // Initial tMax in cell-coordinate space
    const tMaxXInit = If(
      stepX.greaterThan(int(0)),
      () => float(1.0).sub(fracX).div(absDirX),
    ).Else(
      () => fracX.div(absDirX),
    );
    const tMaxZInit = If(
      stepZ.greaterThan(int(0)),
      () => float(1.0).sub(fracZ).div(absDirZ),
    ).Else(
      () => fracZ.div(absDirZ),
    );

    const tMaxX = tMaxXInit.toVar();
    const tMaxZ = tMaxZInit.toVar();

    // DDA loop with "done" flag (TSL has no break)
    const blocked = uint(0).toVar();

    Loop({ start: int(0), end: int(MAX_RAY_STEPS), type: 'int', condition: '<' }, () => {
      If(blocked.equal(uint(0)), () => {
        // Advance to next cell
        If(tMaxX.lessThan(tMaxZ), () => {
          curX.addAssign(stepX);
          tMaxX.addAssign(tDeltaX);
        }).Else(() => {
          curZ.addAssign(stepZ);
          tMaxZ.addAssign(tDeltaZ);
        });

        // Bounds check
        If(curX.lessThan(int(0)).or(curX.greaterThanEqual(gs.toInt()))
          .or(curZ.lessThan(int(0))).or(curZ.greaterThanEqual(gs.toInt())), () => {
          blocked.assign(uint(2)); // exited grid, not blocked
        });

        If(blocked.equal(uint(0)), () => {
          // Reached target cell? Done (not blocked)
          If(curX.equal(cellX.toInt()).and(curZ.equal(cellZ.toInt())), () => {
            blocked.assign(uint(2)); // reached target, not blocked
          });

          If(blocked.equal(uint(0)), () => {
            // Interpolate ray height at current t
            const t = min(tMaxX, tMaxZ);
            const tNorm = t.div(rayLen).clamp(float(0.0), float(1.0));
            // Ray Y: linear interp from viewerY toward ground (Y=0) along the ray
            const rayY = uViewerY.mul(float(1.0).sub(tNorm));

            // Sample heightmap at current cell
            const sampleIdx = curZ.toUint().mul(gs).add(curX.toUint());
            const terrainY = heightmapBuffer.element(sampleIdx);

            // If ray is below terrain → line of sight is blocked
            If(rayY.lessThan(terrainY), () => {
              blocked.assign(uint(1)); // blocked by geometry
            });
          });
        });
      });
    });

    // Write visibility based on result
    If(blocked.equal(uint(1)), () => {
      // Blocked: downgrade VISIBLE → PREVIOUSLY_SEEN, keep others
      If(prevVis.equal(VISIBLE), () => {
        visibilityBuffer.element(cellIdx).assign(PREVIOUSLY_SEEN);
      });
    }).Else(() => {
      // Clear line of sight: apply distance-based visibility
      If(dist.lessThanEqual(uRevealR), () => {
        visibilityBuffer.element(cellIdx).assign(VISIBLE);
      }).Else(() => {
        // Fade zone: lerp between VISIBLE and PREVIOUSLY_SEEN
        const fadeT = dist.sub(uRevealR).div(uTotalR.sub(uRevealR));
        const fadeValue = round(float(255.0).sub(fadeT.mul(float(255.0 - 128.0)))).toUint();
        // Only upgrade, never downgrade
        If(fadeValue.greaterThan(prevVis), () => {
          visibilityBuffer.element(cellIdx).assign(fadeValue);
        });
      });
    });
  })().compute(totalCells);

  return {
    heightmapBuffer,
    visibilityBuffer,
    computeRayMarch,
    uniforms: unis,
    gridConfig: {
      gridSize: c.gridSize,
      cellWorldSize: c.cellWorldSize,
      originX: c.originX,
      originZ: c.originZ,
    },
    totalCells,
  };
}
