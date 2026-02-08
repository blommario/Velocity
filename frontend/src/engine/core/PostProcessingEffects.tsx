import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  PostProcessing, WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace,
} from 'three/webgpu';
import type { DataTexture } from 'three/webgpu';
import {
  pass, renderOutput, viewportUV, screenUV, clamp, texture, float, vec2, vec4,
  cameraNear, cameraFar, cameraProjectionMatrixInverse, cameraWorldMatrix,
  perspectiveDepthToViewZ, getViewPosition,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { devLog, frameTiming } from '../stores/devLogStore';
import type { FogOfWarUniforms } from '../effects/useFogOfWar';

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
  /** R8 DataTexture from useFogOfWar. Omit to disable fog-of-war. */
  fogTexture?: DataTexture | null;
  /** Grid uniforms from useFogOfWar. Required when fogTexture is set. */
  fogUniforms?: FogOfWarUniforms | null;
}

export function PostProcessingEffects({
  fogTexture,
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

    // Fog of war (optional) — depth-based world position reconstruction
    let fogFactor = float(1.0);
    if (fogTexture && fogUniforms) {
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
      // [0, 0.5] → [HIDDEN, PREVIOUSLY_SEEN], [0.5, 1.0] → [PREVIOUSLY_SEEN, 1.0]
      const hiddenBright = float(FOG_BRIGHTNESS.HIDDEN);
      const seenBright = float(FOG_BRIGHTNESS.PREVIOUSLY_SEEN);
      const lowSeg = visibility.mul(2.0).clamp(0.0, 1.0);
      const highSeg = visibility.sub(0.5).mul(2.0).clamp(0.0, 1.0);
      fogFactor = hiddenBright.mix(seenBright, lowSeg).mix(float(1.0), highSeg);

      devLog.success('PostFX', 'Fog of War pass enabled (depth reconstruction)');
    }

    // Combine: scene + bloom → fog → vignette → tonemapping + color space
    const combined = scenePassColor.add(bloomPass).mul(fogFactor).mul(vignetteFactor);
    pipeline.outputNode = renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace);

    pipelineRef.current = pipeline;
    devLog.success('PostFX', `Bloom + Vignette + ACES tonemapping ready${fogTexture ? ' (+ FoW)' : ''}`);

    return () => {
      pipelineRef.current = null;
    };
  }, [renderer, scene, camera, fogTexture, fogUniforms]);

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
