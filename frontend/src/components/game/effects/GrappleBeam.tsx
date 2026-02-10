import { useThree } from '@react-three/fiber';
import { useCallback } from 'react';
import { LineRenderEffect } from '../../../engine/effects/LineRenderEffect';
import { useCombatStore } from '../../../stores/combatStore';

const BEAM_CONFIG = {
  color: '#a78bfa',
  opacity: 0.8,
  segments: 12,
  waveAmplitude: 0.15,
  waveFrequency: 8,
  waveSpeed: 15,
} as const;

export function GrappleBeam() {
  const { camera } = useThree();

  const getStart = useCallback((): [number, number, number] | null => {
    const { isGrappling, grappleTarget } = useCombatStore.getState();
    if (!isGrappling || !grappleTarget) return null;
    return [camera.position.x, camera.position.y, camera.position.z];
  }, [camera]);

  const getEnd = useCallback((): [number, number, number] | null => {
    const { isGrappling, grappleTarget } = useCombatStore.getState();
    if (!isGrappling || !grappleTarget) return null;
    return grappleTarget;
  }, []);

  return <LineRenderEffect getStart={getStart} getEnd={getEnd} config={BEAM_CONFIG} />;
}
