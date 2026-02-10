/**
 * tileLightingNode.ts — Custom TSL fragment node for tile-based clustered lighting.
 *
 * Reads the tile binning output (tileLightCounts, tileLightIndices) and
 * light data (lightPositions, lightColors) as read-only storage buffers,
 * then evaluates Frostbite PBR attenuation + Lambertian diffuse +
 * Blinn-Phong specular per pixel, looping only over lights in the
 * current pixel's tile.
 *
 * Designed for use via material.emissiveNode — adds tile lighting on top
 * of the material's standard rendering (preserving textures, normals, IBL).
 *
 * Engine-level: no game store imports.
 */

import {
  Fn, float, uint, vec3, Loop, If, mix,
  uniform, screenUV,
} from 'three/tsl';
import { positionWorld, normalWorld } from 'three/tsl';
import { cameraPosition } from 'three/tsl';
import { materialColor, materialRoughness, materialMetalness, materialAO } from 'three/tsl';
import { TILE_CONFIG } from './TileClusteredLights';
import type { TileBinningResources } from './tileBinning';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The TSL node returned by createTileLightingNode(). Evaluates to vec3 radiance. */
export type TileLightingNode = ReturnType<ReturnType<typeof Fn>>;

// ---------------------------------------------------------------------------
// Create the fragment lighting node
// ---------------------------------------------------------------------------

/**
 * Build a TSL node that evaluates tile-clustered point light contributions.
 *
 * The returned node is a `vec3` total radiance including albedo modulation.
 * Intended for use as `material.emissiveNode` (additive on top of scene lighting).
 *
 * @param res - The tile binning resources (storage buffers + uniforms).
 * @returns A TSL `vec3` node — total tile-lit radiance.
 */
export function createTileLightingNode(res: TileBinningResources): TileLightingNode {
  const {
    lightPositions,
    lightColors,
    tileLightCounts,
    tileLightIndices,
    uniforms: unis,
  } = res;

  // Read-only views for fragment access
  const roTileCounts = tileLightCounts.toReadOnly();
  const roTileIndices = tileLightIndices.toReadOnly();
  const roLightPos = lightPositions.toReadOnly();
  const roLightCol = lightColors.toReadOnly();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/three uniform() gap
  const uTileCols = uniform(unis.tileCols as any, 'uint');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uViewW = uniform(unis.viewportWidth as any, 'float');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uViewH = uniform(unis.viewportHeight as any, 'float');
  const uMaxPerTile = uint(TILE_CONFIG.MAX_PER_TILE);

  /**
   * Per-pixel: determine tile, loop tile's lights, accumulate PBR lighting.
   *
   * Uses Frostbite windowed attenuation (same as Three.js getDistanceAttenuation):
   *   distanceFalloff = 1 / max(dist², 0.01)
   *   windowed = clamp(1 - (dist/cutoff)⁴, 0, 1)²
   *   attenuation = distanceFalloff × windowed
   *
   * PBR energy conservation via materialMetalness:
   *   metals: zero diffuse, specular colored by albedo
   *   dielectrics: albedo-colored diffuse, white specular (F0=0.04)
   * Specular power derived from materialRoughness.
   */
  const tileLightingFn = Fn(() => {
    // Which tile does this pixel belong to?
    // screenUV: (0,0) = top-left in WebGPU, matching compute shader convention
    const tileX = screenUV.x.mul(uViewW).div(float(TILE_CONFIG.TILE_SIZE)).floor().toUint();
    const tileY = screenUV.y.mul(uViewH).div(float(TILE_CONFIG.TILE_SIZE)).floor().toUint();
    const tileIdx = tileY.mul(uTileCols).add(tileX);

    // Number of lights in this tile (clamped to MAX_PER_TILE by compute)
    const count = roTileCounts.element(tileIdx).min(uMaxPerTile);

    // Surface data
    const P = positionWorld.toVar();
    const N = normalWorld.normalize().toVar();
    const V = cameraPosition.sub(P).normalize().toVar();
    const albedo = materialColor.toVar();

    // PBR metalness: metals have no diffuse, dielectrics have white F0=0.04
    const metalness = materialMetalness.toVar();
    const F0 = vec3(0.04, 0.04, 0.04);
    const specularColor = F0.mix(albedo, metalness).toVar();
    const diffuseColor = albedo.mul(float(1.0).sub(metalness)).toVar();

    // Roughness → specular exponent: smooth (0) → high exp, rough (1) → low exp
    // Approximation: exponent = 2 / roughness^4 - 2, clamped to [2, 2048]
    const r = materialRoughness.clamp(0.045, 1.0).toVar();
    const specExp = float(2.0).div(r.mul(r).mul(r).mul(r)).sub(float(2.0)).clamp(2.0, 2048.0);
    // Normalization factor: (exp + 2) / (8 * PI) ≈ (exp + 2) * 0.04
    const specNorm = specExp.add(float(2.0)).mul(float(0.04));

    // Accumulators
    const totalLight = vec3(0.0, 0.0, 0.0).toVar();

    Loop({ start: uint(0), end: count, type: 'uint', condition: '<' }, ({ i }) => {
      const lightIdx = roTileIndices.element(tileIdx.mul(uMaxPerTile).add(i));

      const posData = roLightPos.element(lightIdx);
      const colData = roLightCol.element(lightIdx);

      const lightWorldPos = vec3(posData.x, posData.y, posData.z);
      const cutoff = posData.w;
      const lightColor = vec3(colData.x, colData.y, colData.z);
      const intensity = colData.w;

      // Vector from surface to light
      const toLight = lightWorldPos.sub(P);
      const dist = toLight.length();
      const lightDir = toLight.div(dist.max(float(0.0001)));

      // Frostbite attenuation (matches Three.js getDistanceAttenuation)
      const distFalloff = dist.mul(dist).max(float(0.01)).reciprocal();
      const ratio = dist.div(cutoff.max(float(0.001)));
      const windowed = ratio.pow(4).oneMinus().clamp(0.0, 1.0).pow(2);
      const attenuation = distFalloff.mul(windowed).mul(intensity);

      // Lambertian diffuse — modulated by diffuseColor (zero for metals)
      const NdotL = N.dot(lightDir).max(float(0.0));
      const diffuseTerm = lightColor.mul(attenuation).mul(NdotL).mul(diffuseColor);

      // Blinn-Phong specular — colored by specularColor (albedo for metals, 0.04 for dielectrics)
      const halfVec = lightDir.add(V).normalize();
      const NdotH = N.dot(halfVec).max(float(0.0));
      const specTerm = lightColor.mul(attenuation).mul(NdotH.pow(specExp).mul(specNorm)).mul(specularColor);

      totalLight.addAssign(diffuseTerm.add(specTerm));
    });

    // Apply AO so tile lighting respects ambient occlusion maps
    return totalLight.mul(materialAO);
  });

  return tileLightingFn();
}

// ---------------------------------------------------------------------------
// Debug: tile heatmap overlay
// ---------------------------------------------------------------------------

/** Debug node type — same signature as TileLightingNode. */
export type TileDebugNode = TileLightingNode;

/**
 * Build a TSL node that visualizes tile light counts as a heatmap.
 *
 * Color gradient: black (0) → green (low) → yellow (mid) → red (MAX_PER_TILE).
 * Tile grid lines rendered as thin dark borders for spatial reference.
 *
 * Intended for `material.colorNode` override during debug.
 *
 * @param res - The tile binning resources (same as createTileLightingNode).
 * @returns A TSL `vec3` node — heatmap color per pixel.
 */
export function createTileDebugNode(res: TileBinningResources): TileDebugNode {
  const { tileLightCounts, uniforms: unis } = res;

  const roTileCounts = tileLightCounts.toReadOnly();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/three uniform() gap
  const uTileCols = uniform(unis.tileCols as any, 'uint');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uViewW = uniform(unis.viewportWidth as any, 'float');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uViewH = uniform(unis.viewportHeight as any, 'float');
  const maxPerTile = float(TILE_CONFIG.MAX_PER_TILE);

  const tileDebugFn = Fn(() => {
    // Pixel → tile coordinate
    const pixelX = screenUV.x.mul(uViewW);
    const pixelY = screenUV.y.mul(uViewH);
    const tileX = pixelX.div(float(TILE_CONFIG.TILE_SIZE)).floor().toUint();
    const tileY = pixelY.div(float(TILE_CONFIG.TILE_SIZE)).floor().toUint();
    const tileIdx = tileY.mul(uTileCols).add(tileX);

    const count = roTileCounts.element(tileIdx).toFloat();
    const t = count.div(maxPerTile).clamp(0.0, 1.0);

    // Heatmap: black → green → yellow → red
    const low = vec3(0.0, 1.0, 0.0);   // green
    const mid = vec3(1.0, 1.0, 0.0);   // yellow
    const high = vec3(1.0, 0.0, 0.0);  // red

    const color = mix(mix(low, mid, t.mul(2.0).clamp(0.0, 1.0)),
                      high,
                      t.mul(2.0).sub(1.0).clamp(0.0, 1.0)).toVar();

    // Darken when count is zero
    If(count.lessThanEqual(float(0.5)), () => {
      color.assign(vec3(0.02, 0.02, 0.05));
    });

    // Tile grid lines (1px border)
    const fracX = pixelX.mod(float(TILE_CONFIG.TILE_SIZE));
    const fracY = pixelY.mod(float(TILE_CONFIG.TILE_SIZE));
    If(fracX.lessThan(float(1.0)).or(fracY.lessThan(float(1.0))), () => {
      color.mulAssign(float(0.3));
    });

    return color;
  });

  return tileDebugFn();
}
