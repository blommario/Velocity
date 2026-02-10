/**
 * Renders a trailing line behind the player that activates above a speed threshold, with color lerp from base to fast.
 * Depends on: R3F useThree (scene) + useFrame, Three.js Line + LineBasicNodeMaterial
 * Used by: Game HUD/effects layer to visualize high-speed movement (speedrunning feedback)
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, LineBasicNodeMaterial, Line, AdditiveBlending, Color } from 'three/webgpu';

export interface SpeedTrailConfig {
  speedThreshold?: number;
  maxPoints?: number;
  updateInterval?: number;
  baseColor?: string;
  fastColor?: string;
  speedForFast?: number;
}

const DEFAULTS: Required<SpeedTrailConfig> = {
  speedThreshold: 400,
  maxPoints: 40,
  updateInterval: 0.03,
  baseColor: '#00ccff',
  fastColor: '#ff4400',
  speedForFast: 800,
} as const;

export interface SpeedTrailProps {
  /** Current speed value */
  getSpeed: () => number;
  /** Current position [x, y, z] */
  getPosition: () => [number, number, number];
  /** Whether the effect is enabled (e.g. particles setting) */
  enabled?: boolean;
  config?: SpeedTrailConfig;
}

// Pre-allocated Colors — reused every frame (zero GC)
const _baseColor = new Color();
const _fastColor = new Color();

export function SpeedTrail({ getSpeed, getPosition, enabled = true, config }: SpeedTrailProps) {
  const { scene } = useThree();
  const lineRef = useRef<Line | null>(null);
  const positionsRef = useRef<[number, number, number][]>([]);
  const timerRef = useRef(0);
  const materialRef = useRef<LineBasicNodeMaterial | null>(null);
  const geometryRef = useRef<BufferGeometry | null>(null);
  const initRef = useRef(false);

  const c = { ...DEFAULTS, ...config };

  useFrame((_, delta) => {
    if (!enabled) return;

    const speed = getSpeed();
    const position = getPosition();

    // Initialize on first frame
    if (!initRef.current) {
      _baseColor.set(c.baseColor);
      _fastColor.set(c.fastColor);

      const geometry = new BufferGeometry();
      const posArray = new Float32Array(c.maxPoints * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(posArray, 3));
      geometry.setDrawRange(0, 0);

      const material = new LineBasicNodeMaterial({
        color: c.baseColor,
        transparent: true,
        opacity: 0.6,
        blending: AdditiveBlending,
        depthWrite: false,
        linewidth: 1,
      });

      const line = new Line(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
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

    timerRef.current += delta;

    if (speed < c.speedThreshold) {
      // Fade out trail
      if (positionsRef.current.length > 0) {
        positionsRef.current.shift();
        updateGeometry(geometry, positionsRef.current);
      }
      line.visible = positionsRef.current.length > 0;
      material.opacity = Math.max(0, material.opacity - delta * 3);
      return;
    }

    // Color lerp based on speed
    const speedFactor = Math.min((speed - c.speedThreshold) / (c.speedForFast - c.speedThreshold), 1);
    material.color.copy(_baseColor).lerp(_fastColor, speedFactor);
    material.opacity = 0.3 + speedFactor * 0.5;

    // Add new point at update interval
    if (timerRef.current >= c.updateInterval) {
      timerRef.current = 0;
      // Trail below player feet
      positionsRef.current.push([position[0], position[1] - 0.5, position[2]]);
      if (positionsRef.current.length > c.maxPoints) {
        positionsRef.current.shift();
      }
      updateGeometry(geometry, positionsRef.current);
      line.visible = true;
    }
  });

  return null;
}

function updateGeometry(geometry: BufferGeometry, points: [number, number, number][]) {
  const attr = geometry.getAttribute('position') as Float32BufferAttribute;
  for (let i = 0; i < points.length; i++) {
    attr.setXYZ(i, points[i][0], points[i][1], points[i][2]);
  }
  attr.needsUpdate = true;
  geometry.setDrawRange(0, points.length);
}
