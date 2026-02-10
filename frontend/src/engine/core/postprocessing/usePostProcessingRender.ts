/**
 * Per-frame render hook for the PostProcessing pipeline. Handles motion blur
 * VP matrix updates (with teleport detection) and pipeline.render() at
 * renderPriority=1 (disables R3F auto-render).
 *
 * Depends on: @react-three/fiber (useFrame), three/webgpu (Matrix4, PerspectiveCamera)
 * Used by: PostProcessingEffects
 */
import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PostProcessing, WebGPURenderer, Matrix4 } from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import { frameTiming } from '../../stores/devLogStore';
import { MOTION_BLUR_TELEPORT_THRESHOLD_SQ } from './motionBlurBuilder';
import type { PipelineUniforms } from './types';

export function usePostProcessingRender(
  pipelineRef: React.RefObject<PostProcessing | null>,
  uniformsRef: React.RefObject<PipelineUniforms | null>,
) {
  const { gl, scene, camera } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const prevVPRef = useRef(new Matrix4());
  const prevCamPosRef = useRef<[number, number, number]>([0, 0, 0]);

  // renderPriority=1 disables R3F auto-rendering; pipeline handles render + post
  useFrame(() => {
    const u = uniformsRef.current;
    if (u?.prevViewProjection) {
      const cam = camera as PerspectiveCamera;
      const cx = cam.position.x;
      const cy = cam.position.y;
      const cz = cam.position.z;
      const dx = cx - prevCamPosRef.current[0];
      const dy = cy - prevCamPosRef.current[1];
      const dz = cz - prevCamPosRef.current[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > MOTION_BLUR_TELEPORT_THRESHOLD_SQ) {
        const currentVP = prevVPRef.current;
        currentVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        u.prevViewProjection.value.copy(currentVP);
      } else {
        u.prevViewProjection.value.copy(prevVPRef.current);
        prevVPRef.current.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      }

      prevCamPosRef.current[0] = cx;
      prevCamPosRef.current[1] = cy;
      prevCamPosRef.current[2] = cz;
    }

    frameTiming.begin('Render');
    const pipeline = pipelineRef.current;
    if (pipeline) {
      pipeline.render();
    } else {
      renderer.render(scene, camera);
    }
    frameTiming.end('Render');
  }, 1);

  return prevVPRef;
}
