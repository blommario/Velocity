import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  PostProcessing, WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace,
} from 'three/webgpu';
import type { DataTexture } from 'three/webgpu';
import {
  pass, renderOutput, viewportUV, screenUV, clamp, texture, float, uint, vec2, vec4,
  cameraNear, cameraFar, cameraProjectionMatrixInverse, cameraWorldMatrix,
  perspectiveDepthToViewZ, getViewPosition, floor, mix,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { devLog, frameTiming } from '../stores/devLogStore';
import { getViewmodelScene } from '../rendering/ViewmodelLayer';
import type { FogOfWarUniforms } from '../effects/useFogOfWar';
import type { FogComputeResources } from '../effects/fogOfWarCompute';

const POST_PROCESSING_DEFAULTS = {
  bloomThreshold: 0.8,
  bloomStrength: 0.4,
  bloomRadius: 0.3,
  vignetteIntensity: 1.2,
  vignetteSoftness: 0.5,
} as const;

const FOG_BRIGHTNESS = {
  /** Brightness multiplier for HIDDEN areas (0 in texture). */
  HIDDEN: 0.05,
  /** Brightness multiplier for PREVIOUSLY_SEEN areas (128/255 in texture). */
  PREVIOUSLY_SEEN: 0.35,
} as const;

export interface PostProcessingProps {
  /** Bloom luminance threshold (default 0.8). */
  bloomThreshold?: number;
  /** Bloom intensity (default 0.4). */
  bloomStrength?: number;
  /** Bloom radius (default 0.3). */
  bloomRadius?: number;
  /** Vignette edge-darkening intensity (default 1.2). */
  vignetteIntensity?: number;
  /** Vignette softness falloff (default 0.5). */
  vignetteSoftness?: number;
  /** R8 DataTexture from useFogOfWar (CPU path). Omit to disable fog-of-war. */
  fogTexture?: DataTexture | null;
  /** GPU compute resources from useFogOfWar (GPU path). Omit for CPU path. */
  fogComputeResources?: FogComputeResources | null;
  /** Grid uniforms from useFogOfWar. Required when any fog path is active. */
  fogUniforms?: FogOfWarUniforms | null;
}

export function PostProcessingEffects({
  bloomThreshold = POST_PROCESSING_DEFAULTS.bloomThreshold,
  bloomStrength = POST_PROCESSING_DEFAULTS.bloomStrength,
  bloomRadius = POST_PROCESSING_DEFAULTS.bloomRadius,
  vignetteIntensity = POST_PROCESSING_DEFAULTS.vignetteIntensity,
  vignetteSoftness = POST_PROCESSING_DEFAULTS.vignetteSoftness,
  fogTexture,
  fogComputeResources,
  fogUniforms,
}: PostProcessingProps = {}) {
  const { gl, scene, camera } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const pipelineRef = useRef<PostProcessing | null>(null);

  useEffect(() => {
    try {
      const pipeline = new PostProcessing(renderer);
      pipeline.outputColorTransform = false;

      const scenePass = pass(scene, camera);
      const scenePassColor = scenePass.getTextureNode('output');

      // Bloom
      const bloomPass = bloom(scenePassColor);
      bloomPass.threshold.value = bloomThreshold;
      bloomPass.strength.value = bloomStrength;
      bloomPass.radius.value = bloomRadius;

      // Vignette: darken edges based on distance from screen center
      const vignetteFactor = clamp(
        viewportUV.sub(0.5).length().mul(vignetteIntensity),
        0.0,
        1.0,
      ).oneMinus().pow(vignetteSoftness);

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

      // ── Viewmodel compositing ──
      // Render viewmodel scene on top of world scene (depth cleared between passes)
      const vmRef = getViewmodelScene();
      let worldWithViewmodel = scenePassColor.add(bloomPass).mul(fogFactor);

      if (vmRef) {
        const vmPass = pass(vmRef.scene, vmRef.camera);
        vmPass.setClearColor(0x000000, 0); // transparent background
        const vmColor = vmPass.getTextureNode('output');
        const vmDepth = vmPass.getTextureNode('depth');

        // Viewmodel bloom (same settings as world)
        const vmBloomPass = bloom(vmColor);
        vmBloomPass.threshold.value = bloomThreshold;
        vmBloomPass.strength.value = bloomStrength;
        vmBloomPass.radius.value = bloomRadius;

        const vmWithBloom = vmColor.add(vmBloomPass);

        // Composite: where viewmodel has content (depth < 1.0), use viewmodel color
        // Depth = 1.0 means background (no geometry rendered) — keep world color
        const vmMask = vmDepth.lessThan(float(0.9999)).toFloat();
        worldWithViewmodel = mix(worldWithViewmodel, vmWithBloom, vmMask);

        devLog.success('PostFX', 'Viewmodel compositing enabled');
      }

      // Combine: (world+viewmodel) → vignette → tonemapping + color space
      const combined = worldWithViewmodel.mul(vignetteFactor);
      pipeline.outputNode = renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace);

      pipelineRef.current = pipeline;
      const fogLabel = fogComputeResources ? ' (+ FoW GPU)' : fogTexture ? ' (+ FoW CPU)' : '';
      const vmLabel = vmRef ? ' + Viewmodel' : '';
      devLog.success('PostFX', `Bloom + Vignette + ACES tonemapping ready${fogLabel}${vmLabel}`);
    } catch (err) {
      devLog.error('PostFX', `PostProcessing pipeline creation failed: ${err}`);
      pipelineRef.current = null;
    }

    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.dispose();
      }
      pipelineRef.current = null;
    };
  }, [renderer, scene, camera, bloomThreshold, bloomStrength, bloomRadius, vignetteIntensity, vignetteSoftness, fogTexture, fogComputeResources, fogUniforms]);

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
