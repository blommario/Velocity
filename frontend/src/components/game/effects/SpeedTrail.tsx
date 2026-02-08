import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, LineBasicNodeMaterial, Line, AdditiveBlending, Color } from 'three/webgpu';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';

const TRAIL = {
  SPEED_THRESHOLD: 400,
  MAX_POINTS: 40,
  UPDATE_INTERVAL: 0.03,  // ~33Hz
  BASE_COLOR: '#00ccff',
  FAST_COLOR: '#ff4400',
  SPEED_FOR_FAST: 800,
} as const;

// Pre-allocated Colors — reused every frame in useFrame (zero GC)
const _baseColor = new Color(TRAIL.BASE_COLOR);
const _fastColor = new Color(TRAIL.FAST_COLOR);

export function SpeedTrail() {
  const { scene, camera } = useThree();
  const lineRef = useRef<Line | null>(null);
  const positionsRef = useRef<[number, number, number][]>([]);
  const timerRef = useRef(0);
  const materialRef = useRef<LineBasicNodeMaterial | null>(null);
  const geometryRef = useRef<BufferGeometry | null>(null);
  const initRef = useRef(false);

  useFrame((_, delta) => {
    if (!useSettingsStore.getState().particles) return;

    const speed = useGameStore.getState().speed;
    const position = useGameStore.getState().position;

    // Initialize on first frame
    if (!initRef.current) {
      const geometry = new BufferGeometry();
      const posArray = new Float32Array(TRAIL.MAX_POINTS * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(posArray, 3));
      geometry.setDrawRange(0, 0);

      const material = new LineBasicNodeMaterial({
        color: TRAIL.BASE_COLOR,
        transparent: true,
        opacity: 0.6,
        blending: AdditiveBlending,
        depthWrite: false,
        linewidth: 1,
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

    timerRef.current += delta;

    if (speed < TRAIL.SPEED_THRESHOLD) {
      // Fade out trail
      if (positionsRef.current.length > 0) {
        positionsRef.current.shift();
        updateGeometry(geometry, positionsRef.current);
      }
      material.opacity = Math.max(0, material.opacity - delta * 3);
      return;
    }

    // Color lerp based on speed
    const speedFactor = Math.min((speed - TRAIL.SPEED_THRESHOLD) / (TRAIL.SPEED_FOR_FAST - TRAIL.SPEED_THRESHOLD), 1);
    material.color.copy(_baseColor).lerp(_fastColor, speedFactor);
    material.opacity = 0.3 + speedFactor * 0.5;

    // Add new point at update interval
    if (timerRef.current >= TRAIL.UPDATE_INTERVAL) {
      timerRef.current = 0;
      // Trail below player feet
      positionsRef.current.push([position[0], position[1] - 0.5, position[2]]);
      if (positionsRef.current.length > TRAIL.MAX_POINTS) {
        positionsRef.current.shift();
      }
      updateGeometry(geometry, positionsRef.current);
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
