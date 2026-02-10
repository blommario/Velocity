/**
 * Inline TSL SSAO node builder — samples depth at spiral offsets around each
 * pixel, reconstructs view-space positions, and computes occlusion by comparing
 * depth differences within a hemisphere. Runs entirely in the fragment shader.
 *
 * Avoids GTAONode which generates invalid WGSL shader modules in
 * Three.js r182 WebGPU backend.
 *
 * Depends on: three/tsl (TSL node functions)
 * Used by: PostProcessingEffects pipeline construction
 */
import {
  screenUV, clamp, float, vec2,
  cameraNear, cameraFar, cameraProjectionMatrixInverse,
  perspectiveDepthToViewZ, getViewPosition,
  hash, time, Fn, Loop, int, max, step,
} from 'three/tsl';

/** Number of depth samples for SSAO. 8 is a good perf/quality trade-off. */
const SSAO_SAMPLES = 8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSsaoNode(depthNode: any, uRadius: any, uIntensity: any) {
  const goldenAngle = float(2.399963); // ~137.5 degrees in radians

  return Fn(() => {
    const centerDepthRaw = depthNode.sample(screenUV).r;
    const isSky = centerDepthRaw.greaterThanEqual(0.9999);

    const centerViewZ = perspectiveDepthToViewZ(centerDepthRaw, cameraNear, cameraFar);
    const centerViewPos = getViewPosition(screenUV, centerViewZ, cameraProjectionMatrixInverse);

    const occlusion = float(0.0).toVar();
    const sampleCount = float(0.0).toVar();

    const noiseVal = hash(screenUV.add(time.mul(0.1)));

    Loop({ start: int(0), end: int(SSAO_SAMPLES), type: 'int', condition: '<' }, ({ i }: { i: ReturnType<typeof int> }) => {
      const angle = float(i).mul(goldenAngle).add(noiseVal.mul(6.283));
      const radius = float(i).add(0.5).div(float(SSAO_SAMPLES)).sqrt().mul(uRadius);
      const offset = vec2(angle.cos().mul(radius), angle.sin().mul(radius));

      const sampleUV = screenUV.add(offset.mul(vec2(float(1.0).div(cameraProjectionMatrixInverse.element(int(0)).element(int(0)).abs()), float(1.0))));

      const sampleDepthRaw = depthNode.sample(sampleUV).r;
      const sampleViewZ = perspectiveDepthToViewZ(sampleDepthRaw, cameraNear, cameraFar);
      const sampleViewPos = getViewPosition(sampleUV, sampleViewZ, cameraProjectionMatrixInverse);

      const diff = centerViewPos.sub(sampleViewPos);
      const dist = diff.length();
      const rangeCheck = float(1.0).sub(clamp(dist.div(uRadius.mul(50.0)), 0.0, 1.0));
      const depthDiff = centerViewZ.sub(sampleViewZ);
      const occluded = step(float(0.02), depthDiff).mul(rangeCheck);
      occlusion.addAssign(occluded);
      sampleCount.addAssign(1.0);
    });

    const aoRaw = float(1.0).sub(occlusion.div(max(sampleCount, float(1.0))).mul(uIntensity));
    return isSky.select(float(1.0), clamp(aoRaw, 0.0, 1.0));
  })();
}
