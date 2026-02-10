import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute, PointsNodeMaterial,
  Points, AdditiveBlending,
} from 'three/webgpu';

export interface ObjectHighlightConfig {
  particleCount?: number;
  spread?: number;
  riseSpeed?: number;
  life?: number;
  size?: number;
  color?: string;
}

const DEFAULTS: Required<ObjectHighlightConfig> = {
  particleCount: 32,
  spread: 3,
  riseSpeed: 2,
  life: 1.5,
  size: 0.15,
  color: '#ffd700',
} as const;

interface ShimmerParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
}

export interface ObjectHighlightProps {
  /** Called each frame; return a position [x,y,z] to spawn a burst, or null */
  getBurstPosition: () => [number, number, number] | null;
  config?: ObjectHighlightConfig;
}

export function ObjectHighlight({ getBurstPosition, config }: ObjectHighlightProps) {
  const { scene } = useThree();
  const pointsRef = useRef<Points | null>(null);
  const particlesRef = useRef<ShimmerParticle[]>([]);
  const initRef = useRef(false);
  const geometryRef = useRef<BufferGeometry | null>(null);
  const materialRef = useRef<PointsNodeMaterial | null>(null);
  const lastBurstRef = useRef(false);

  const c = { ...DEFAULTS, ...config };

  useFrame((_, delta) => {
    // Initialize
    if (!initRef.current) {
      const geometry = new BufferGeometry();
      const posArray = new Float32Array(c.particleCount * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(posArray, 3));
      geometry.setDrawRange(0, 0);

      const material = new PointsNodeMaterial({
        color: c.color,
        size: c.size,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const points = new Points(geometry, material);
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      pointsRef.current = points;
      geometryRef.current = geometry;
      materialRef.current = material;
      initRef.current = true;
    }

    const geometry = geometryRef.current;
    if (!geometry) return;

    // Check for burst trigger
    const burstPos = getBurstPosition();
    if (burstPos && !lastBurstRef.current) {
      // Spawn burst at position
      for (let i = 0; i < c.particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.3) * Math.PI;
        const speed = 1 + Math.random() * c.riseSpeed;
        particlesRef.current.push({
          x: burstPos[0] + (Math.random() - 0.5) * 2,
          y: burstPos[1] + Math.random() * 2,
          z: burstPos[2] + (Math.random() - 0.5) * 2,
          vx: Math.cos(angle) * Math.cos(elevation) * speed,
          vy: Math.abs(Math.sin(elevation)) * speed + 1,
          vz: Math.sin(angle) * Math.cos(elevation) * speed,
          life: c.life * (0.5 + Math.random() * 0.5),
        });
      }
    }
    lastBurstRef.current = burstPos !== null;

    // Update particles
    const alive: ShimmerParticle[] = [];
    for (const p of particlesRef.current) {
      p.life -= delta;
      if (p.life <= 0) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vy -= 1.5 * delta; // gentle gravity
      alive.push(p);
    }
    particlesRef.current = alive;

    // Update geometry
    const attr = geometry.getAttribute('position') as Float32BufferAttribute;
    for (let i = 0; i < alive.length && i < c.particleCount; i++) {
      attr.setXYZ(i, alive[i].x, alive[i].y, alive[i].z);
    }
    attr.needsUpdate = true;
    const drawCount = Math.min(alive.length, c.particleCount);
    geometry.setDrawRange(0, drawCount);
    pointsRef.current!.visible = drawCount > 0;
  });

  return null;
}
