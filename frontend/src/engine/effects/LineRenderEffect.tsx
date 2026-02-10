import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute, LineBasicNodeMaterial,
  Line, AdditiveBlending,
} from 'three/webgpu';

export interface LineRenderConfig {
  color?: string;
  opacity?: number;
  segments?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  waveSpeed?: number;
  fadeOutRate?: number;
}

const DEFAULTS: Required<LineRenderConfig> = {
  color: '#a78bfa',
  opacity: 0.8,
  segments: 12,
  waveAmplitude: 0.15,
  waveFrequency: 8,
  waveSpeed: 15,
  fadeOutRate: 8,
} as const;

export interface LineRenderEffectProps {
  /** Start point [x,y,z] — typically camera/player position */
  getStart: () => [number, number, number] | null;
  /** End point [x,y,z] — target position, null = inactive */
  getEnd: () => [number, number, number] | null;
  config?: LineRenderConfig;
}

export function LineRenderEffect({ getStart, getEnd, config }: LineRenderEffectProps) {
  const { scene } = useThree();
  const lineRef = useRef<Line | null>(null);
  const materialRef = useRef<LineBasicNodeMaterial | null>(null);
  const geometryRef = useRef<BufferGeometry | null>(null);
  const initRef = useRef(false);
  const timeRef = useRef(0);

  const c = { ...DEFAULTS, ...config };

  useFrame((_, delta) => {
    // Initialize on first frame
    if (!initRef.current) {
      const geometry = new BufferGeometry();
      const posArray = new Float32Array((c.segments + 1) * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(posArray, 3));

      const material = new LineBasicNodeMaterial({
        color: c.color,
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

    const start = getStart();
    const end = getEnd();

    if (!start || !end) {
      material.opacity = Math.max(0, material.opacity - delta * c.fadeOutRate);
      line.visible = material.opacity > 0.01;
      return;
    }

    timeRef.current += delta;
    material.opacity = c.opacity;
    line.visible = true;

    const attr = geometry.getAttribute('position') as Float32BufferAttribute;

    for (let i = 0; i <= c.segments; i++) {
      const t = i / c.segments;
      // Interpolate position along the line
      const x = start[0] + (end[0] - start[0]) * t;
      const y = start[1] + (end[1] - start[1]) * t;
      const z = start[2] + (end[2] - start[2]) * t;

      // Add wave displacement in the middle of the beam
      const waveFactor = Math.sin(t * Math.PI); // peaks at center
      const wave = Math.sin(t * c.waveFrequency + timeRef.current * c.waveSpeed) * c.waveAmplitude * waveFactor;

      attr.setXYZ(i, x + wave * 0.5, y + wave, z + wave * 0.5);
    }
    attr.needsUpdate = true;
  });

  return null;
}
