/**
 * PostProcessing pipeline orchestrator — constructs the TSL node graph on
 * structural changes (boolean toggles, fog resources) and updates uniform
 * values without rebuild. Renders at priority 1 (disables R3F auto-render).
 *
 * Depends on: postprocessing/ builders, three/webgpu PostProcessing, R3F
 * Used by: GameCanvas
 */
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { PostProcessing } from 'three/webgpu';
import { WebGPURenderer } from 'three/webgpu';
import { devLog } from '../stores/devLogStore';
import { buildPostProcessingPipeline } from './postprocessing/buildPipeline';
import { usePostProcessingRender } from './postprocessing/usePostProcessingRender';
import { POST_PROCESSING_DEFAULTS } from './postprocessing/types';
import type { PipelineUniforms, PostProcessingProps } from './postprocessing/types';

export type { PostProcessingProps } from './postprocessing/types';

export function PostProcessingEffects({
  bloomThreshold = POST_PROCESSING_DEFAULTS.bloomThreshold,
  bloomStrength = POST_PROCESSING_DEFAULTS.bloomStrength,
  bloomRadius = POST_PROCESSING_DEFAULTS.bloomRadius,
  vignetteIntensity = POST_PROCESSING_DEFAULTS.vignetteIntensity,
  vignetteSoftness = POST_PROCESSING_DEFAULTS.vignetteSoftness,
  ssaoEnabled = true,
  colorGradingEnabled = true,
  exposure = POST_PROCESSING_DEFAULTS.exposure,
  contrast = POST_PROCESSING_DEFAULTS.contrast,
  saturation = POST_PROCESSING_DEFAULTS.saturation,
  colorTemperature = POST_PROCESSING_DEFAULTS.colorTemperature,
  filmGrainEnabled = false,
  filmGrainAmount = POST_PROCESSING_DEFAULTS.filmGrainAmount,
  chromaticAberrationEnabled = false,
  chromaticAberrationOffset = POST_PROCESSING_DEFAULTS.chromaticAberrationOffset,
  motionBlurEnabled = false,
  motionBlurStrength = POST_PROCESSING_DEFAULTS.motionBlurStrength,
  depthOfFieldEnabled = false,
  dofFocusDistance = POST_PROCESSING_DEFAULTS.dofFocusDistance,
  dofAperture = POST_PROCESSING_DEFAULTS.dofAperture,
  fogTexture,
  fogComputeResources,
  fogUniforms,
}: PostProcessingProps = {}) {
  const { gl, scene, camera } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const pipelineRef = useRef<PostProcessing | null>(null);
  const uniformsRef = useRef<PipelineUniforms | null>(null);

  // ── Pipeline construction — only on structural changes ──
  useEffect(() => {
    try {
      const result = buildPostProcessingPipeline(renderer, scene, camera, {
        bloomThreshold, bloomStrength, bloomRadius,
        vignetteIntensity, vignetteSoftness,
        ssaoEnabled, colorGradingEnabled,
        exposure, contrast, saturation, colorTemperature,
        filmGrainEnabled, filmGrainAmount,
        chromaticAberrationEnabled, chromaticAberrationOffset,
        motionBlurEnabled, motionBlurStrength,
        depthOfFieldEnabled, dofFocusDistance, dofAperture,
        fogTexture, fogComputeResources, fogUniforms,
      });
      pipelineRef.current = result.pipeline;
      uniformsRef.current = result.uniforms;
    } catch (err) {
      devLog.error('PostFX', `Pipeline creation failed: ${err}`);
      pipelineRef.current = null;
      uniformsRef.current = null;
    }

    return () => {
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
      uniformsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, scene, camera,
    ssaoEnabled, colorGradingEnabled, filmGrainEnabled, chromaticAberrationEnabled,
    motionBlurEnabled, depthOfFieldEnabled,
    fogTexture, fogComputeResources, fogUniforms]);

  // ── Uniform updates — no pipeline rebuild ──
  useEffect(() => {
    const u = uniformsRef.current;
    if (!u) return;

    u.bloomThreshold.value = bloomThreshold;
    u.bloomStrength.value = bloomStrength;
    u.bloomRadius.value = bloomRadius;
    u.vignetteIntensity.value = vignetteIntensity;
    u.vignetteSoftness.value = vignetteSoftness;

    if (u.vmBloomThreshold) u.vmBloomThreshold.value = bloomThreshold;
    if (u.vmBloomStrength) u.vmBloomStrength.value = bloomStrength;
    if (u.vmBloomRadius) u.vmBloomRadius.value = bloomRadius;

    if (u.exposure) u.exposure.value = exposure;
    if (u.contrast) u.contrast.value = contrast;
    if (u.saturation) u.saturation.value = saturation;
    if (u.colorTemperature) u.colorTemperature.value = colorTemperature;
    if (u.filmGrainAmount) u.filmGrainAmount.value = filmGrainAmount;
    if (u.chromaticAberrationOffset) u.chromaticAberrationOffset.value = chromaticAberrationOffset;
    if (u.motionBlurStrength) u.motionBlurStrength.value = motionBlurStrength;
    if (u.dofFocusDistance) u.dofFocusDistance.value = dofFocusDistance;
    if (u.dofAperture) u.dofAperture.value = dofAperture;
  }, [bloomThreshold, bloomStrength, bloomRadius,
    vignetteIntensity, vignetteSoftness,
    exposure, contrast, saturation, colorTemperature,
    filmGrainAmount, chromaticAberrationOffset,
    motionBlurStrength, dofFocusDistance, dofAperture]);

  // ── Render loop (priority 1 = disables R3F auto-render) ──
  usePostProcessingRender(pipelineRef, uniformsRef);

  return null;
}
