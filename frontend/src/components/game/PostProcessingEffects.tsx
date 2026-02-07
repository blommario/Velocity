import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PostProcessing, WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace } from 'three/webgpu';
import { pass, renderOutput, viewportUV, clamp } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { useSettingsStore } from '../../stores/settingsStore';
import { devLog } from '../../stores/devLogStore';

const POST_PROCESSING = {
  BLOOM_THRESHOLD: 0.8,
  BLOOM_STRENGTH: 0.4,
  BLOOM_RADIUS: 0.3,
  VIGNETTE_INTENSITY: 1.2,
  VIGNETTE_SOFTNESS: 0.5,
} as const;

export function PostProcessingEffects() {
  const { gl, scene, camera } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const pipelineRef = useRef<PostProcessing | null>(null);

  useEffect(() => {
    const pipeline = new PostProcessing(renderer);

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

    // Combine: scene + bloom → vignette → tonemapping + color space
    const combined = scenePassColor.add(bloomPass).mul(vignetteFactor);
    pipeline.outputNode = renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace);

    pipelineRef.current = pipeline;
    devLog.success('PostFX', 'Bloom + Vignette + ACES tonemapping ready');

    return () => {
      pipelineRef.current = null;
    };
  }, [renderer, scene, camera]);

  // renderPriority=1 disables R3F auto-rendering
  useFrame(() => {
    const bloomEnabled = useSettingsStore.getState().bloom;
    if (pipelineRef.current && bloomEnabled) {
      pipelineRef.current.render();
    } else {
      renderer.render(scene, camera);
    }
  }, 1);

  return null;
}
