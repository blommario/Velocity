import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute, LineBasicMaterial,
  Line, AdditiveBlending,
} from 'three';
import { useCombatStore } from '../../../stores/combatStore';
import { PHYSICS } from '../physics/constants';

const BEAM = {
  COLOR: '#a78bfa',
  OPACITY: 0.8,
  SEGMENTS: 12,
  WAVE_AMPLITUDE: 0.15,
  WAVE_FREQUENCY: 8,
  WAVE_SPEED: 15,
} as const;

export function GrappleBeam() {
  const { scene, camera } = useThree();
  const lineRef = useRef<Line | null>(null);
  const materialRef = useRef<LineBasicMaterial | null>(null);
  const geometryRef = useRef<BufferGeometry | null>(null);
  const initRef = useRef(false);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    const { isGrappling, grappleTarget } = useCombatStore.getState();

    // Initialize on first frame
    if (!initRef.current) {
      const geometry = new BufferGeometry();
      const posArray = new Float32Array((BEAM.SEGMENTS + 1) * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(posArray, 3));

      const material = new LineBasicMaterial({
        color: BEAM.COLOR,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        linewidth: 2,
      });

      const line = new Line(geometry, material);
      line.frustumCulled = false;
      scene.add(line);
      lineRef.current = line;
      materialRef.current = material;
      geometryRef.current = geometry;
      initRef.current = true;
    }

    const line = lineRef.current;
    const geometry = geometryRef.current;
    const material = materialRef.current;
    if (!line || !geometry || !material) return;

    if (!isGrappling || !grappleTarget) {
      material.opacity = Math.max(0, material.opacity - delta * 8);
      line.visible = material.opacity > 0.01;
      return;
    }

    timeRef.current += delta;
    material.opacity = BEAM.OPACITY;
    line.visible = true;

    // Camera position is player's eye position
    const camPos = camera.position;
    const target = grappleTarget;
    const attr = geometry.getAttribute('position') as Float32BufferAttribute;

    for (let i = 0; i <= BEAM.SEGMENTS; i++) {
      const t = i / BEAM.SEGMENTS;
      // Interpolate position along the beam
      const x = camPos.x + (target[0] - camPos.x) * t;
      const y = camPos.y + (target[1] - camPos.y) * t;
      const z = camPos.z + (target[2] - camPos.z) * t;

      // Add wave displacement in the middle of the beam
      const waveFactor = Math.sin(t * Math.PI); // peaks at center
      const wave = Math.sin(t * BEAM.WAVE_FREQUENCY + timeRef.current * BEAM.WAVE_SPEED) * BEAM.WAVE_AMPLITUDE * waveFactor;

      attr.setXYZ(i, x + wave * 0.5, y + wave, z + wave * 0.5);
    }
    attr.needsUpdate = true;
  });

  return null;
}
