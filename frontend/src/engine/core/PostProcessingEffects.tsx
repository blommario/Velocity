import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  PostProcessing, WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace,
} from 'three/webgpu';
import type { DataTexture } from 'three/webgpu';
import {
  pass, renderOutput, viewportUV, screenUV, clamp, texture, float, uint, vec2, vec4,
  cameraNear, cameraFar, cameraProjectionMatrixInverse, cameraWorldMatrix,
  perspectiveDepthToViewZ, getViewPosition, uniform, floor, min,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { devLog, frameTiming } from '../stores/devLogStore';
import type { FogOfWarUniforms } from '../effects/useFogOfWar';
import type { FogComputeResources } from '../effects/fogOfWarCompute';

const POST_PROCESSING = {
  BLOOM_THRESHOLD: 0.8,
  BLOOM_STRENGTH: 0.4,
  BLOOM_RADIUS: 0.3,
  VIGNETTE_INTENSITY: 1.2,
  VIGNETTE_SOFTNESS: 0.5,
} as const;

const FOG_BRIGHTNESS = {
  /** Brightness multiplier for HIDDEN areas (0 in texture). */
  HIDDEN: 0.05,
  /** Brightness multiplier for PREVIOUSLY_SEEN areas (128/255 in texture). */
  PREVIOUSLY_SEEN: 0.35,
} as const;

export interface PostProcessingProps {
  /** R8 DataTexture from useFogOfWar (CPU path). Omit to disable fog-of-war. */
  fogTexture?: DataTexture | null;
  /** GPU compute resources from useFogOfWar (GPU path). Omit for CPU path. */
  fogComputeResources?: FogComputeResources | null;
  /** Grid uniforms from useFogOfWar. Required when any fog path is active. */
  fogUniforms?: FogOfWarUniforms | null;
}

export function PostProcessingEffects({
  fogTexture,
  fogComputeResources,
  fogUniforms,
}: PostProcessingProps = {}) {
  const { gl, scene, camera } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const pipelineRef = useRef<PostProcessing | null>(null);

  useEffect(() => {
    const pipeline = new PostProcessing(renderer);
    pipeline.outputColorTransform = false;

    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode('output');

    // Bloom
    const bloomPass = bloom(scenePassColor);
    bloomPass.threshold.value = POST_PROCESSING.BLOOM_THRESHOLD;
    bloomPass.strength.value = POST_PROCESSING.BLOOM_STRENGTH;
    bloomPass.radius.value = POST_PROCESSING.BLOOM_RADIUS;

    // Vignette: darken edges based on distance from screen center
    const vignetteFactor = clamp(
      viewportUV.sub(0.5).length().mul(POST_PROCESSING.VIGNETTE_INTENSITY),
      0.0,
      1.0,
    ).oneMinus().pow(POST_PROCESSING.VIGNETTE_SOFTNESS);

    // Fog of war — two paths: GPU storage buffer or CPU DataTexture
    let fogFactor = float(1.0);

    if (fogComputeResources && fogUniforms) {
      // ── GPU path: read visibility from storage buffer ──
      const roVisibility = fogComputeResources.visibilityBuffer.toReadOnly();
      const gc = fogComputeResources.gridConfig;
      const fogOriginX = float(gc.originX);
      const fogOriginZ = float(gc.originZ);
      const fogCellWS = float(gc.cellWorldSize);
      const fogGS = uint(gc.gridSize);
      const fogGSf = float(gc.gridSize);

      // Reconstruct world position from depth buffer per-pixel
      const depthTex = scenePass.getTextureNode('depth');
      const viewZ = perspectiveDepthToViewZ(depthTex, cameraNear, cameraFar);
      const viewPos = getViewPosition(screenUV, viewZ, cameraProjectionMatrixInverse);
      const worldPos = cameraWorldMatrix.mul(vec4(viewPos, 1.0));

      // World XZ → cell index
      const cellXf = worldPos.x.sub(fogOriginX).div(fogCellWS);
      const cellZf = worldPos.z.sub(fogOriginZ).div(fogCellWS);
      const cellX = floor(cellXf).clamp(float(0.0), fogGSf.sub(float(1.0))).toUint();
      const cellZ = floor(cellZf).clamp(float(0.0), fogGSf.sub(float(1.0))).toUint();
      const cellIdx = cellZ.mul(fogGS).add(cellX);

      // Read uint visibility (0/128/255) → normalize to 0..1
      const visibility = roVisibility.element(cellIdx).toFloat().div(float(255.0));

      // Same two-segment brightness mapping as CPU path
      const hiddenBright = float(FOG_BRIGHTNESS.HIDDEN);
      const seenBright = float(FOG_BRIGHTNESS.PREVIOUSLY_SEEN);
      const lowSeg = visibility.mul(2.0).clamp(0.0, 1.0);
      const highSeg = visibility.sub(0.5).mul(2.0).clamp(0.0, 1.0);
      fogFactor = hiddenBright.mix(seenBright, lowSeg).mix(float(1.0), highSeg);

      devLog.success('PostFX', 'Fog of War GPU path enabled (storage buffer read)');
    } else if (fogTexture && fogUniforms) {
      // ── CPU path: sample DataTexture ──
      const fogTex = texture(fogTexture);
      const fogOriginX = float(fogUniforms.originX);
      const fogOriginZ = float(fogUniforms.originZ);
      const fogWorldSize = float(fogUniforms.gridSize * fogUniforms.cellWorldSize);

      // Reconstruct world position from depth buffer per-pixel
      const depthTex = scenePass.getTextureNode('depth');
      const viewZ = perspectiveDepthToViewZ(depthTex, cameraNear, cameraFar);
      const viewPos = getViewPosition(screenUV, viewZ, cameraProjectionMatrixInverse);
      const worldPos = cameraWorldMatrix.mul(vec4(viewPos, 1.0));

      // World XZ → fog grid UV (0..1)
      const fogU = worldPos.x.sub(fogOriginX).div(fogWorldSize);
      const fogV = worldPos.z.sub(fogOriginZ).div(fogWorldSize);
      const fogUV = vec2(fogU, fogV);

      // Sample R channel (0..1, where 0=HIDDEN, ~0.5=PREVIOUSLY_SEEN, 1.0=VISIBLE)
      const visibility = fogTex.sample(fogUV).r;

      // Map visibility → brightness (branchless two-segment lerp)
      const hiddenBright = float(FOG_BRIGHTNESS.HIDDEN);
      const seenBright = float(FOG_BRIGHTNESS.PREVIOUSLY_SEEN);
      const lowSeg = visibility.mul(2.0).clamp(0.0, 1.0);
      const highSeg = visibility.sub(0.5).mul(2.0).clamp(0.0, 1.0);
      fogFactor = hiddenBright.mix(seenBright, lowSeg).mix(float(1.0), highSeg);

      devLog.success('PostFX', 'Fog of War CPU path enabled (depth reconstruction)');
    }

    // Combine: scene + bloom → fog → vignette → tonemapping + color space
    const combined = scenePassColor.add(bloomPass).mul(fogFactor).mul(vignetteFactor);
    pipeline.outputNode = renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace);

    pipelineRef.current = pipeline;
    const fogLabel = fogComputeResources ? ' (+ FoW GPU)' : fogTexture ? ' (+ FoW CPU)' : '';
    devLog.success('PostFX', `Bloom + Vignette + ACES tonemapping ready${fogLabel}`);

    return () => {
      pipelineRef.current = null;
    };
  }, [renderer, scene, camera, fogTexture, fogComputeResources, fogUniforms]);

  // renderPriority=1 disables R3F auto-rendering; pipeline handles render + post
  useFrame(() => {
    frameTiming.begin('Render');
    const pipeline = pipelineRef.current;
    if (pipeline) {
      pipeline.render();
    } else {
      renderer.render(scene, camera);
    }
    frameTiming.end('Render');
  }, 1);

  return null;
}
