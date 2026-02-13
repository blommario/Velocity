/**
 * Constructs the PostProcessing pipeline node graph. Wires up scene pass,
 * bloom, vignette, SSAO, fog-of-war, motion blur, viewmodel compositing,
 * DoF, color grading, chromatic aberration, and film grain into a single
 * output node with ACES tone mapping.
 *
 * Depends on: three/webgpu, three/tsl, bloom node, all postprocessing builders
 * Used by: PostProcessingEffects (pipeline construction useEffect)
 */
import {
  PostProcessing, WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace,
  Matrix4,
} from 'three/webgpu';
import type { Camera, Scene, PerspectiveCamera } from 'three/webgpu';
import {
  pass, renderOutput, viewportUV, clamp, float, vec4,
  mix, uniform, hash, time,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { devLog } from '../../stores/devLogStore';
import { getViewmodelScene } from '../../rendering/ViewmodelLayer';
import { buildSsaoNode } from './ssaoBuilder';
import { buildMotionBlurNode, MOTION_BLUR_SAMPLES } from './motionBlurBuilder';
import { buildDofNode } from './dofBuilder';
import { buildGpuFogNode, buildCpuFogNode } from './fogOfWarNodes';
import { POST_PROCESSING_DEFAULTS } from './types';
import type { PipelineUniforms, PostProcessingProps } from './types';

interface BuildResult {
  pipeline: PostProcessing;
  uniforms: PipelineUniforms;
  /** If motion blur is active, the prevVP uniform that needs per-frame updates. */
  prevVPInitMatrix?: Matrix4;
}

export function buildPostProcessingPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  props: Required<Pick<PostProcessingProps,
    'bloomThreshold' | 'bloomStrength' | 'bloomRadius' |
    'vignetteIntensity' | 'vignetteSoftness' |
    'ssaoEnabled' | 'colorGradingEnabled' |
    'exposure' | 'contrast' | 'saturation' | 'colorTemperature' |
    'filmGrainEnabled' | 'filmGrainAmount' |
    'chromaticAberrationEnabled' | 'chromaticAberrationOffset' |
    'motionBlurEnabled' | 'motionBlurStrength' |
    'depthOfFieldEnabled' | 'dofFocusDistance' | 'dofAperture'
  >> & Pick<PostProcessingProps, 'fogTexture' | 'fogComputeResources' | 'fogUniforms'>,
): BuildResult {
  const pipeline = new PostProcessing(renderer);
  pipeline.outputColorTransform = false;

  const scenePass = pass(scene, camera);
  const scenePassColor = scenePass.getTextureNode('output');

  // ── SSAO ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aoFactor: any = float(1.0);
  let uSsaoRadius: { value: number } | undefined;
  let uSsaoIntensity: { value: number } | undefined;

  if (props.ssaoEnabled) {
    const scenePassDepth = scenePass.getTextureNode('depth');
    uSsaoRadius = uniform(POST_PROCESSING_DEFAULTS.ssaoRadius);
    uSsaoIntensity = uniform(POST_PROCESSING_DEFAULTS.ssaoIntensity);
    aoFactor = buildSsaoNode(scenePassDepth, uSsaoRadius, uSsaoIntensity);
    devLog.success('PostFX', 'SSAO enabled (inline TSL, 8 samples)');
  }

  // ── Bloom ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uBloomThreshold: any = uniform(props.bloomThreshold);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uBloomStrength: any = uniform(props.bloomStrength);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uBloomRadius: any = uniform(props.bloomRadius);
  const bloomPass = bloom(scenePassColor);
  bloomPass.threshold = uBloomThreshold;
  bloomPass.strength = uBloomStrength;
  bloomPass.radius = uBloomRadius;

  // ── Vignette ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uVignetteIntensity: any = uniform(props.vignetteIntensity);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uVignetteSoftness: any = uniform(props.vignetteSoftness);
  const vignetteFactor = clamp(
    viewportUV.sub(0.5).length().mul(uVignetteIntensity), 0.0, 1.0,
  ).oneMinus().pow(uVignetteSoftness);

  // ── Fog of War ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fogFactor: any = float(1.0);
  if (props.fogComputeResources && props.fogUniforms) {
    const depthTex = scenePass.getTextureNode('depth');
    fogFactor = buildGpuFogNode(depthTex, props.fogComputeResources);
    devLog.success('PostFX', 'Fog of War GPU path enabled (storage buffer read)');
  } else if (props.fogTexture && props.fogUniforms) {
    const depthTex = scenePass.getTextureNode('depth');
    fogFactor = buildCpuFogNode(depthTex, props.fogTexture, props.fogUniforms);
    devLog.success('PostFX', 'Fog of War CPU path enabled (depth reconstruction)');
  }

  // ── Motion Blur ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uMotionBlurStrength: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uPrevVP: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let motionBlurredColor: any = scenePassColor;
  let prevVPInitMatrix: Matrix4 | undefined;

  if (props.motionBlurEnabled) {
    const mbDepth = scenePass.getTextureNode('depth');
    uMotionBlurStrength = uniform(props.motionBlurStrength);
    const cam = camera as PerspectiveCamera;
    const initVP = new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    prevVPInitMatrix = new Matrix4().copy(initVP);
    uPrevVP = uniform(initVP);
    motionBlurredColor = buildMotionBlurNode(scenePassColor, mbDepth, uPrevVP, uMotionBlurStrength);
    devLog.success('PostFX', `Motion blur enabled (${MOTION_BLUR_SAMPLES} samples)`);
  }

  // ── Depth of Field (applied to scene texture BEFORE viewmodel compositing) ──
  // DoF uses .sample() which requires a texture node, not a computed node.
  // Running it here on motionBlurredColor (texture) avoids the TSL error.
  // Viewmodel is composited after, so weapons stay sharp (no bokeh on arms).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uDofFocusDist: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uDofAperture: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dofColor: any = motionBlurredColor;

  if (props.depthOfFieldEnabled) {
    const dofDepth = scenePass.getTextureNode('depth');
    uDofFocusDist = uniform(props.dofFocusDistance);
    uDofAperture = uniform(props.dofAperture);
    dofColor = buildDofNode(motionBlurredColor, dofDepth, uDofFocusDist, uDofAperture);
    devLog.success('PostFX', 'Depth of Field enabled (12 samples, bokeh disc)');
  }

  // ── Viewmodel compositing ──
  const vmRef = getViewmodelScene();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worldWithViewmodel: any = dofColor.add(bloomPass).mul(fogFactor).mul(aoFactor);

  let uVmBloomThreshold: { value: number } | undefined;
  let uVmBloomStrength: { value: number } | undefined;
  let uVmBloomRadius: { value: number } | undefined;

  if (vmRef) {
    const vmPass = pass(vmRef.scene, vmRef.camera);
    const vmColor = vmPass.getTextureNode('output');
    const vmDepth = vmPass.getTextureNode('depth');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vmBloomUThreshold: any = uniform(props.bloomThreshold);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vmBloomUStrength: any = uniform(props.bloomStrength);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vmBloomURadius: any = uniform(props.bloomRadius);
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

  // ── Vignette ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let combined: any = worldWithViewmodel.mul(vignetteFactor);

  // ── Color Grading ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uExposure: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uContrast: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uSaturation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uColorTemp: any;

  if (props.colorGradingEnabled) {
    uExposure = uniform(props.exposure);
    uContrast = uniform(props.contrast);
    uSaturation = uniform(props.saturation);
    uColorTemp = uniform(props.colorTemperature);

    combined = combined.mul(uExposure);
    combined = combined.sub(0.5).mul(uContrast).add(0.5);

    const luma = combined.r.mul(0.2126).add(combined.g.mul(0.7152)).add(combined.b.mul(0.0722));
    combined = mix(vec4(luma, luma, luma, 1.0), combined, uSaturation);

    const tempShift = uColorTemp.mul(0.1);
    combined = vec4(combined.r.add(tempShift), combined.g, combined.b.sub(tempShift), combined.a);
    devLog.success('PostFX', 'Color grading enabled');
  }

  // ── Chromatic Aberration ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uCaOffset: any;

  if (props.chromaticAberrationEnabled) {
    uCaOffset = uniform(props.chromaticAberrationOffset);
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

  // ── Film Grain ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uGrainAmount: any;

  if (props.filmGrainEnabled) {
    uGrainAmount = uniform(props.filmGrainAmount);
    const grainSeed = viewportUV.add(time).mul(1000.0);
    const noise = hash(grainSeed).sub(0.5).mul(uGrainAmount);
    combined = combined.add(vec4(noise, noise, noise, 0.0));
    devLog.success('PostFX', 'Film grain enabled');
  }

  combined = combined.max(0.0);
  pipeline.outputNode = renderOutput(combined, ACESFilmicToneMapping, SRGBColorSpace);

  // Log active features
  const features: string[] = ['Bloom', 'Vignette', 'ACES'];
  if (props.ssaoEnabled) features.push('SSAO');
  if (props.colorGradingEnabled) features.push('ColorGrade');
  if (props.filmGrainEnabled) features.push('FilmGrain');
  if (props.chromaticAberrationEnabled) features.push('ChromAb');
  if (props.motionBlurEnabled) features.push('MotionBlur');
  if (props.depthOfFieldEnabled) features.push('DoF');
  if (props.fogComputeResources) features.push('FoW-GPU');
  else if (props.fogTexture) features.push('FoW-CPU');
  if (vmRef) features.push('Viewmodel');
  devLog.success('PostFX', `Pipeline ready: ${features.join(' + ')}`);

  return {
    pipeline,
    uniforms: {
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
      motionBlurStrength: uMotionBlurStrength,
      prevViewProjection: uPrevVP,
      dofFocusDistance: uDofFocusDist,
      dofAperture: uDofAperture,
    },
    prevVPInitMatrix,
  };
}
