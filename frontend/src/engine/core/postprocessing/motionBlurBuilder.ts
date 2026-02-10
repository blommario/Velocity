/**
 * Camera-based motion blur via depth-buffer velocity reconstruction.
 * Stores the previous frame's ViewProjection matrix as a TSL uniform,
 * then for each pixel: reconstruct world position from depth -> project
 * with previous VP -> compute screen-space velocity -> sample along it.
 *
 * Depends on: three/tsl (TSL node functions)
 * Used by: PostProcessingEffects pipeline construction
 */
import {
  screenUV, float, vec4,
  cameraNear, cameraFar, cameraProjectionMatrixInverse, cameraWorldMatrix,
  perspectiveDepthToViewZ, getViewPosition,
  Fn, Loop, int, max,
} from 'three/tsl';

/** Number of samples for motion blur along velocity vector. */
export const MOTION_BLUR_SAMPLES = 8;

/** If camera moves more than this in a single frame, skip blur (teleport/respawn). */
export const MOTION_BLUR_TELEPORT_THRESHOLD_SQ = 400; // 20 units squared

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMotionBlurNode(colorNode: any, depthNode: any, uPrevVP: any, uStrength: any) {
  return Fn(() => {
    const depthRaw = depthNode.sample(screenUV).r;
    const isSky = depthRaw.greaterThanEqual(0.9999);

    const viewZ = perspectiveDepthToViewZ(depthRaw, cameraNear, cameraFar);
    const viewPos = getViewPosition(screenUV, viewZ, cameraProjectionMatrixInverse);
    const worldPos = cameraWorldMatrix.mul(vec4(viewPos, 1.0));

    const prevClip = uPrevVP.mul(worldPos);
    const prevNDC = prevClip.xy.div(prevClip.w);
    const prevUV = prevNDC.mul(0.5).add(0.5);

    const velocity = screenUV.sub(prevUV).mul(uStrength);

    const velLen = velocity.length();
    const maxVel = float(0.05);
    const clampedVel = velocity.mul(maxVel.div(max(velLen, maxVel)));

    const accum = vec4(0.0, 0.0, 0.0, 0.0).toVar();
    const stepUV = clampedVel.div(float(MOTION_BLUR_SAMPLES));

    Loop({ start: int(0), end: int(MOTION_BLUR_SAMPLES), type: 'int', condition: '<' }, ({ i }: { i: ReturnType<typeof int> }) => {
      const sampleUV = screenUV.add(stepUV.mul(float(i).sub(float(MOTION_BLUR_SAMPLES).mul(0.5))));
      accum.addAssign(colorNode.sample(sampleUV));
    });

    const blurred = accum.div(float(MOTION_BLUR_SAMPLES));
    return isSky.select(colorNode.sample(screenUV), blurred);
  })();
}
