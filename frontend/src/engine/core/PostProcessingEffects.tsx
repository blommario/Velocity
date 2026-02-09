import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  PostProcessing, WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace,
} from 'three/webgpu';
import type { DataTexture } from 'three/webgpu';
import {
  pass, renderOutput, viewportUV, screenUV, clamp, texture, float, uint, vec2, vec4,
  cameraNear, cameraFar, cameraProjectionMatrixInverse, cameraWorldMatrix,
  perspectiveDepthToViewZ, getViewPosition, floor, mix, uniform,
  hash, time, Fn, Loop, int, abs, max, step,
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
  ssaoRadius: 0.5,
  ssaoIntensity: 1.5,
  exposure: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  colorTemperature: 0.0,
  filmGrainAmount: 0.06,
  chromaticAberrationOffset: 0.003,
} as const;

/** Number of depth samples for SSAO. 8 is a good perf/quality trade-off. */
const SSAO_SAMPLES = 8;

/**
 * Inline TSL SSAO: samples depth at spiral offsets around each pixel,
 * reconstructs view-space positions, and computes occlusion by comparing
 * depth differences within a hemisphere. Runs entirely in the fragment
 * shader — no separate render pass or QuadMesh needed.
 *
 * This avoids GTAONode which generates invalid WGSL shader modules in
 * Three.js r182 WebGPU backend.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSsaoNode(depthNode: any, uRadius: any, uIntensity: any) {
  // Golden angle spiral for sample distribution
  const goldenAngle = float(2.399963); // ~137.5° in radians

  return Fn(() => {
    const centerDepthRaw = depthNode.sample(screenUV).r;
    // Skip sky pixels (depth ≈ 1.0)
    const isSky = centerDepthRaw.greaterThanEqual(0.9999);

    const centerViewZ = perspectiveDepthToViewZ(centerDepthRaw, cameraNear, cameraFar);
    const centerViewPos = getViewPosition(screenUV, centerViewZ, cameraProjectionMatrixInverse);

    const occlusion = float(0.0).toVar();
    const sampleCount = float(0.0).toVar();

    // Noise based on screen UV for temporal variation
    const noiseVal = hash(screenUV.add(time.mul(0.1)));

    Loop({ start: int(0), end: int(SSAO_SAMPLES), type: 'int', condition: '<' }, ({ i }: { i: ReturnType<typeof int> }) => {
      // Spiral sample pattern
      const angle = float(i).mul(goldenAngle).add(noiseVal.mul(6.283));
      const radius = float(i).add(0.5).div(float(SSAO_SAMPLES)).sqrt().mul(uRadius);
      const offset = vec2(angle.cos().mul(radius), angle.sin().mul(radius));

      // Aspect-ratio correction: divide x offset by aspect to keep kernel circular
      const sampleUV = screenUV.add(offset.mul(vec2(float(1.0).div(cameraProjectionMatrixInverse.element(0).element(0).abs()), 1.0)));

      const sampleDepthRaw = depthNode.sample(sampleUV).r;
      const sampleViewZ = perspectiveDepthToViewZ(sampleDepthRaw, cameraNear, cameraFar);
      const sampleViewPos = getViewPosition(sampleUV, sampleViewZ, cameraProjectionMatrixInverse);

      const diff = centerViewPos.sub(sampleViewPos);
      const dist = diff.length();
      // Range check: only occlude within a reasonable distance
      const rangeCheck = float(1.0).sub(clamp(dist.div(uRadius.mul(50.0)), 0.0, 1.0));
      // Occlusion: sample is in front of center (closer to camera = more negative viewZ)
      const depthDiff = centerViewZ.sub(sampleViewZ);
      const occluded = step(float(0.02), depthDiff).mul(rangeCheck);
      occlusion.addAssign(occluded);
      sampleCount.addAssign(1.0);
    });

    const aoRaw = float(1.0).sub(occlusion.div(max(sampleCount, float(1.0))).mul(uIntensity));
    // Clamp and return — sky pixels get full brightness
    return isSky.select(float(1.0), clamp(aoRaw, 0.0, 1.0));
  })();
}

const FOG_BRIGHTNESS = {
  /** Brightness multiplier for HIDDEN areas (0 in texture). */
  HIDDEN: 0.05,
  /** Brightness multiplier for PREVIOUSLY_SEEN areas (128/255 in texture). */
  PREVIOUSLY_SEEN: 0.35,
} as const;

/** Mutable uniform handles — updated without pipeline rebuild. */
interface PipelineUniforms {
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
  fogTexture,
  fogComputeResources,
  fogUniforms,
}: PostProcessingProps = {}) {
  const { gl, scene, camera } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const pipelineRef = useRef<PostProcessing | null>(null);
  const uniformsRef = useRef<PipelineUniforms | null>(null);

  // ── Pipeline construction — only on structural changes ──
  // Boolean toggles and fog resources change the node graph → rebuild required.
  // Numeric params use TSL uniform() nodes → updated via .value without rebuild.
  useEffect(() => {
    try {
      const pipeline = new PostProcessing(renderer);
      pipeline.outputColorTransform = false;

      const scenePass = pass(scene, camera);
      const scenePassColor = scenePass.getTextureNode('output');

      // ── SSAO (inline TSL — no GTAONode) ──
      let aoFactor = float(1.0);
      let uSsaoRadius: { value: number } | undefined;
      let uSsaoIntensity: { value: number } | undefined;

      if (ssaoEnabled) {
        const scenePassDepth = scenePass.getTextureNode('depth');
        uSsaoRadius = uniform(POST_PROCESSING_DEFAULTS.ssaoRadius);
        uSsaoIntensity = uniform(POST_PROCESSING_DEFAULTS.ssaoIntensity);
        aoFactor = buildSsaoNode(scenePassDepth, uSsaoRadius, uSsaoIntensity);
        devLog.success('PostFX', 'SSAO enabled (inline TSL, 8 samples)');
      }

      // ── Bloom (uniform-driven) ──
      const uBloomThreshold = uniform(bloomThreshold);
      const uBloomStrength = uniform(bloomStrength);
      const uBloomRadius = uniform(bloomRadius);

      const bloomPass = bloom(scenePassColor);
      bloomPass.threshold = uBloomThreshold;
      bloomPass.strength = uBloomStrength;
      bloomPass.radius = uBloomRadius;

      // Vignette: darken edges based on distance from screen center (uniform-driven)
      const uVignetteIntensity = uniform(vignetteIntensity);
      const uVignetteSoftness = uniform(vignetteSoftness);
      const vignetteFactor = clamp(
        viewportUV.sub(0.5).length().mul(uVignetteIntensity),
        0.0,
        1.0,
      ).oneMinus().pow(uVignetteSoftness);

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
      const vmRef = getViewmodelScene();
      let worldWithViewmodel = scenePassColor.add(bloomPass).mul(fogFactor).mul(aoFactor);

      // Track viewmodel bloom uniforms if present
      let uVmBloomThreshold: { value: number } | undefined;
      let uVmBloomStrength: { value: number } | undefined;
      let uVmBloomRadius: { value: number } | undefined;

      if (vmRef) {
        const vmPass = pass(vmRef.scene, vmRef.camera);
        vmPass.setClearColor(0x000000, 0);
        const vmColor = vmPass.getTextureNode('output');
        const vmDepth = vmPass.getTextureNode('depth');

        const vmBloomUThreshold = uniform(bloomThreshold);
        const vmBloomUStrength = uniform(bloomStrength);
        const vmBloomURadius = uniform(bloomRadius);
        uVmBloomThreshold = vmBloomUThreshold;
        uVmBloomStrength = vmBloomUStrength;
        uVmBloomRadius = vmBloomURadius;

        const vmBloomPass = bloom(vmColor);
        vmBloomPass.threshold = vmBloomUThreshold;
        vmBloomPass.strength = vmBloomUStrength;
        vmBloomPass.radius = vmBloomURadius;

        const vmWithBloom = vmColor.add(vmBloomPass);
        const vmMask = vmDepth.lessThan(float(0.9999)).toFloat();
        worldWithViewmodel = mix(worldWithViewmodel, vmWithBloom, vmMask);

        devLog.success('PostFX', 'Viewmodel compositing enabled');
      }

      // Apply vignette
      let combined = worldWithViewmodel.mul(vignetteFactor);

      // ── Color Grading (uniform-driven) ──
      let uExposure: { value: number } | undefined;
      let uContrast: { value: number } | undefined;
      let uSaturation: { value: number } | undefined;
      let uColorTemp: { value: number } | undefined;

      if (colorGradingEnabled) {
        uExposure = uniform(exposure);
        uContrast = uniform(contrast);
        uSaturation = uniform(saturation);
        uColorTemp = uniform(colorTemperature);

        // Exposure
        combined = combined.mul(uExposure);

        // Contrast (pivot at 0.5 in linear, applied before tonemapping)
        combined = combined.sub(0.5).mul(uContrast).add(0.5);

        // Saturation (luminance-based)
        const luma = combined.r.mul(0.2126).add(combined.g.mul(0.7152)).add(combined.b.mul(0.0722));
        combined = mix(vec4(luma, luma, luma, 1.0), combined, uSaturation);

        // Color temperature (always in graph — uniform 0.0 = no-op)
        const tempShift = uColorTemp.mul(0.1);
        combined = vec4(
          combined.r.add(tempShift),
          combined.g,
          combined.b.sub(tempShift),
          combined.a,
        );

        devLog.success('PostFX', 'Color grading enabled');
      }

      // ── Chromatic Aberration (uniform-driven) ──
      let uCaOffset: { value: number } | undefined;

      if (chromaticAberrationEnabled) {
        uCaOffset = uniform(chromaticAberrationOffset);
        const uvCenter = viewportUV.sub(0.5);
        const caDir = uvCenter.mul(uCaOffset);
        const rSample = scenePassColor.sample(viewportUV.add(caDir)).r;
        const bSample = scenePassColor.sample(viewportUV.sub(caDir)).b;
        combined = vec4(
          combined.r.add(rSample.sub(scenePassColor.r).mul(0.5)),
          combined.g,
          combined.b.add(bSample.sub(scenePassColor.b).mul(0.5)),
          combined.a,
        );
        devLog.success('PostFX', 'Chromatic aberration enabled');
      }

      // ── Film Grain (uniform-driven) ──
      let uGrainAmount: { value: number } | undefined;

      if (filmGrainEnabled) {
        uGrainAmount = uniform(filmGrainAmount);
        const grainSeed = viewportUV.add(time).mul(1000.0);
        const noise = hash(grainSeed).sub(0.5).mul(uGrainAmount);
        combined = combined.add(vec4(noise, noise, noise, 0.0));
        devLog.success('PostFX', 'Film grain enabled');
      }

      // Clamp to avoid negative values before tonemapping
      combined = combined.max(0.0);

      pipeline.outputNode = renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace);

      pipelineRef.current = pipeline;
      uniformsRef.current = {
        bloomThreshold: uBloomThreshold,
        bloomStrength: uBloomStrength,
        bloomRadius: uBloomRadius,
        vignetteIntensity: uVignetteIntensity,
        vignetteSoftness: uVignetteSoftness,
        vmBloomThreshold: uVmBloomThreshold,
        vmBloomStrength: uVmBloomStrength,
        vmBloomRadius: uVmBloomRadius,
        ssaoRadius: uSsaoRadius,
        ssaoIntensity: uSsaoIntensity,
        exposure: uExposure,
        contrast: uContrast,
        saturation: uSaturation,
        colorTemperature: uColorTemp,
        filmGrainAmount: uGrainAmount,
        chromaticAberrationOffset: uCaOffset,
      };

      const features: string[] = ['Bloom', 'Vignette', 'ACES'];
      if (ssaoEnabled) features.push('SSAO');
      if (colorGradingEnabled) features.push('ColorGrade');
      if (filmGrainEnabled) features.push('FilmGrain');
      if (chromaticAberrationEnabled) features.push('ChromAb');
      if (fogComputeResources) features.push('FoW-GPU');
      else if (fogTexture) features.push('FoW-CPU');
      if (vmRef) features.push('Viewmodel');
      devLog.success('PostFX', `Pipeline ready: ${features.join(' + ')}`);
    } catch (err) {
      devLog.error('PostFX', `PostProcessing pipeline creation failed: ${err}`);
      pipelineRef.current = null;
      uniformsRef.current = null;
    }

    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.dispose();
      }
      pipelineRef.current = null;
      uniformsRef.current = null;
    };
    // Only structural deps — booleans that change the node graph, fog resources
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, scene, camera,
    ssaoEnabled, colorGradingEnabled, filmGrainEnabled, chromaticAberrationEnabled,
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
  }, [bloomThreshold, bloomStrength, bloomRadius,
    vignetteIntensity, vignetteSoftness,
    exposure, contrast, saturation, colorTemperature,
    filmGrainAmount, chromaticAberrationOffset]);

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
