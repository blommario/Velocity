/**
 * Fog-of-war TSL node builders for PostProcessing pipeline.
 * Two paths: GPU storage buffer read (compute-driven) and CPU DataTexture sample.
 * Both reconstruct world position from depth buffer and map to grid visibility.
 *
 * Depends on: three/tsl, FogOfWarUniforms, FogComputeResources
 * Used by: PostProcessingEffects pipeline construction
 */
import {
  screenUV, float, uint, vec2, vec4,
  cameraNear, cameraFar, cameraProjectionMatrixInverse, cameraWorldMatrix,
  perspectiveDepthToViewZ, getViewPosition, floor, texture,
} from 'three/tsl';
import type { DataTexture } from 'three/webgpu';
import type { FogOfWarUniforms } from '../../effects/useFogOfWar';
import type { FogComputeResources } from '../../effects/fogOfWarCompute';
import { FOG_BRIGHTNESS } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/**
 * Build fog-of-war factor from GPU compute storage buffer.
 * Reads per-cell visibility (uint 0/128/255) and maps to brightness.
 */
export function buildGpuFogNode(
  scenePassDepthNode: TslNode,
  resources: FogComputeResources,
): TslNode {
  const roVisibility = resources.visibilityBuffer.toReadOnly();
  const gc = resources.gridConfig;
  const fogOriginX = float(gc.originX);
  const fogOriginZ = float(gc.originZ);
  const fogCellWS = float(gc.cellWorldSize);
  const fogGS = uint(gc.gridSize);
  const fogGSf = float(gc.gridSize);

  const viewZ = perspectiveDepthToViewZ(scenePassDepthNode, cameraNear, cameraFar);
  const viewPos = getViewPosition(screenUV, viewZ, cameraProjectionMatrixInverse);
  const worldPos = cameraWorldMatrix.mul(vec4(viewPos, 1.0));

  const cellXf = worldPos.x.sub(fogOriginX).div(fogCellWS);
  const cellZf = worldPos.z.sub(fogOriginZ).div(fogCellWS);
  const cellX = floor(cellXf).clamp(float(0.0), fogGSf.sub(float(1.0))).toUint();
  const cellZ = floor(cellZf).clamp(float(0.0), fogGSf.sub(float(1.0))).toUint();
  const cellIdx = cellZ.mul(fogGS).add(cellX);

  const visibility = roVisibility.element(cellIdx).toFloat().div(float(255.0));

  const hiddenBright = float(FOG_BRIGHTNESS.HIDDEN);
  const seenBright = float(FOG_BRIGHTNESS.PREVIOUSLY_SEEN);
  const lowSeg = visibility.mul(2.0).clamp(0.0, 1.0);
  const highSeg = visibility.sub(0.5).mul(2.0).clamp(0.0, 1.0);
  return hiddenBright.mix(seenBright, lowSeg).mix(float(1.0), highSeg);
}

/**
 * Build fog-of-war factor from CPU DataTexture.
 * Samples R channel and maps visibility to brightness.
 */
export function buildCpuFogNode(
  scenePassDepthNode: TslNode,
  fogTextureData: DataTexture,
  uniforms: FogOfWarUniforms,
): TslNode {
  const fogTex = texture(fogTextureData);
  const fogOriginX = float(uniforms.originX);
  const fogOriginZ = float(uniforms.originZ);
  const fogWorldSize = float(uniforms.gridSize * uniforms.cellWorldSize);

  const viewZ = perspectiveDepthToViewZ(scenePassDepthNode, cameraNear, cameraFar);
  const viewPos = getViewPosition(screenUV, viewZ, cameraProjectionMatrixInverse);
  const worldPos = cameraWorldMatrix.mul(vec4(viewPos, 1.0));

  const fogU = worldPos.x.sub(fogOriginX).div(fogWorldSize);
  const fogV = worldPos.z.sub(fogOriginZ).div(fogWorldSize);
  const fogUV = vec2(fogU, fogV);

  const visibility = fogTex.sample(fogUV).r;

  const hiddenBright = float(FOG_BRIGHTNESS.HIDDEN);
  const seenBright = float(FOG_BRIGHTNESS.PREVIOUSLY_SEEN);
  const lowSeg = visibility.mul(2.0).clamp(0.0, 1.0);
  const highSeg = visibility.sub(0.5).mul(2.0).clamp(0.0, 1.0);
  return hiddenBright.mix(seenBright, lowSeg).mix(float(1.0), highSeg);
}
