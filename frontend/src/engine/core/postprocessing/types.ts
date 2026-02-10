/**
 * Shared types, defaults, and constants for the PostProcessing pipeline.
 * Depends on: three/webgpu (DataTexture type), FogOfWarUniforms, FogComputeResources
 * Used by: PostProcessingEffects, all postprocessing builder modules
 */
import type { DataTexture } from 'three/webgpu';
import type { FogOfWarUniforms } from '../../effects/useFogOfWar';
import type { FogComputeResources } from '../../effects/fogOfWarCompute';

export const POST_PROCESSING_DEFAULTS = {
  bloomThreshold: 0.8,
  bloomStrength: 0.4,
  bloomRadius: 0.3,
  vignetteIntensity: 1.2,
  vignetteSoftness: 0.5,
  ssaoRadius: 0.5,
  ssaoIntensity: 1.5,
  exposure: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  colorTemperature: 0.0,
  filmGrainAmount: 0.06,
  chromaticAberrationOffset: 0.003,
  motionBlurStrength: 1.0,
  dofFocusDistance: 50.0,
  dofAperture: 2.0,
} as const;

export const FOG_BRIGHTNESS = {
  /** Brightness multiplier for HIDDEN areas (0 in texture). */
  HIDDEN: 0.05,
  /** Brightness multiplier for PREVIOUSLY_SEEN areas (128/255 in texture). */
  PREVIOUSLY_SEEN: 0.35,
} as const;

/** Mutable uniform handles — updated without pipeline rebuild. */
export interface PipelineUniforms {
  bloomThreshold: { value: number };
  bloomStrength: { value: number };
  bloomRadius: { value: number };
  vignetteIntensity: { value: number };
  vignetteSoftness: { value: number };
  vmBloomThreshold?: { value: number };
  vmBloomStrength?: { value: number };
  vmBloomRadius?: { value: number };
  ssaoRadius?: { value: number };
  ssaoIntensity?: { value: number };
  exposure?: { value: number };
  contrast?: { value: number };
  saturation?: { value: number };
  colorTemperature?: { value: number };
  filmGrainAmount?: { value: number };
  chromaticAberrationOffset?: { value: number };
  motionBlurStrength?: { value: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prevViewProjection?: any;
  dofFocusDistance?: { value: number };
  dofAperture?: { value: number };
}

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
  /** Enable SSAO (GTAO). Default true. */
  ssaoEnabled?: boolean;
  /** Enable color grading (exposure, contrast, saturation, temperature). Default true. */
  colorGradingEnabled?: boolean;
  /** Exposure multiplier (default 1.0). */
  exposure?: number;
  /** Contrast multiplier (default 1.0). */
  contrast?: number;
  /** Saturation multiplier (default 1.0). */
  saturation?: number;
  /** Color temperature shift, -1 (cool) to 1 (warm) (default 0). */
  colorTemperature?: number;
  /** Enable film grain noise overlay. Default false. */
  filmGrainEnabled?: boolean;
  /** Film grain intensity (default 0.06). */
  filmGrainAmount?: number;
  /** Enable chromatic aberration. Default false. */
  chromaticAberrationEnabled?: boolean;
  /** Chromatic aberration offset (default 0.003). */
  chromaticAberrationOffset?: number;
  /** Enable camera motion blur. Default false. */
  motionBlurEnabled?: boolean;
  /** Motion blur strength multiplier (default 1.0). */
  motionBlurStrength?: number;
  /** Enable bokeh depth of field. Default false. */
  depthOfFieldEnabled?: boolean;
  /** DoF focus distance in world units (default 50). */
  dofFocusDistance?: number;
  /** DoF aperture size — larger = more blur (default 2.0). */
  dofAperture?: number;
  /** R8 DataTexture from useFogOfWar (CPU path). Omit to disable fog-of-war. */
  fogTexture?: DataTexture | null;
  /** GPU compute resources from useFogOfWar (GPU path). Omit for CPU path. */
  fogComputeResources?: FogComputeResources | null;
  /** Grid uniforms from useFogOfWar. Required when any fog path is active. */
  fogUniforms?: FogOfWarUniforms | null;
}
