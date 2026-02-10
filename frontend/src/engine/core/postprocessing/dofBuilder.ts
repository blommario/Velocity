/**
 * Bokeh-style depth of field using circle-of-confusion from depth buffer.
 * Samples a disc pattern around each pixel, weighted by CoC size.
 * Designed for replays/spectator — large aperture gives cinematic look.
 *
 * Depends on: three/tsl (TSL node functions)
 * Used by: PostProcessingEffects pipeline construction
 */
import {
  screenUV, float, vec2, vec4,
  cameraNear, cameraFar,
  perspectiveDepthToViewZ, mix,
  Fn, Loop, int, abs, max,
} from 'three/tsl';

/** Number of samples for the DoF bokeh disc kernel. */
const DOF_SAMPLES = 12;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDofNode(colorNode: any, depthNode: any, uFocusDist: any, uAperture: any) {
  const goldenAngle = float(2.399963);

  return Fn(() => {
    const depthRaw = depthNode.sample(screenUV).r;
    const isSky = depthRaw.greaterThanEqual(0.9999);

    const viewZ = perspectiveDepthToViewZ(depthRaw, cameraNear, cameraFar).negate();
    const coc = abs(viewZ.sub(uFocusDist)).div(uFocusDist).mul(uAperture).clamp(0.0, 1.0);

    const accum = vec4(0.0, 0.0, 0.0, 0.0).toVar();
    const totalWeight = float(0.0).toVar();

    Loop({ start: int(0), end: int(DOF_SAMPLES), type: 'int', condition: '<' }, ({ i }: { i: ReturnType<typeof int> }) => {
      const angle = float(i).mul(goldenAngle);
      const radius = float(i).add(0.5).div(float(DOF_SAMPLES)).sqrt().mul(coc).mul(0.02);
      const offset = vec2(angle.cos().mul(radius), angle.sin().mul(radius));
      const sampleUV = screenUV.add(offset);

      const sampleColor = colorNode.sample(sampleUV);
      const sampleDepth = depthNode.sample(sampleUV).r;
      const sampleViewZ = perspectiveDepthToViewZ(sampleDepth, cameraNear, cameraFar).negate();
      const sampleCoc = abs(sampleViewZ.sub(uFocusDist)).div(uFocusDist).mul(uAperture).clamp(0.0, 1.0);

      const w = sampleCoc.add(0.001);
      accum.addAssign(sampleColor.mul(w));
      totalWeight.addAssign(w);
    });

    const blurred = accum.div(max(totalWeight, float(0.001)));
    const sharp = colorNode.sample(screenUV);
    const result = mix(sharp, blurred, coc.smoothstep(0.0, 0.15));
    return isSky.select(sharp, result);
  })();
}
