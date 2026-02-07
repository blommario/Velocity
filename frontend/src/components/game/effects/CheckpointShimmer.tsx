import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute, PointsMaterial,
  Points, AdditiveBlending, Color,
} from 'three';
import { useGameStore } from '../../../stores/gameStore';

const SHIMMER = {
  PARTICLE_COUNT: 32,
  SPREAD: 3,
  RISE_SPEED: 2,
  LIFE: 1.5,
  SIZE: 0.15,
  COLOR: '#ffd700',
} as const;

interface ShimmerParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
}

export function CheckpointShimmer() {
  const { scene } = useThree();
  const pointsRef = useRef<Points | null>(null);
  const particlesRef = useRef<ShimmerParticle[]>([]);
  const initRef = useRef(false);
  const lastCheckpointRef = useRef(-1);
  const geometryRef = useRef<BufferGeometry | null>(null);
  const materialRef = useRef<PointsMaterial | null>(null);

  useFrame((_, delta) => {
    // Initialize
    if (!initRef.current) {
      const geometry = new BufferGeometry();
      const posArray = new Float32Array(SHIMMER.PARTICLE_COUNT * 3);
      geometry.setAttribute('position', new Float32BufferAttribute(posArray, 3));
      geometry.setDrawRange(0, 0);

      const material = new PointsMaterial({
        color: SHIMMER.COLOR,
        size: SHIMMER.SIZE,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const points = new Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);
      pointsRef.current = points;
      geometryRef.current = geometry;
      materialRef.current = material;
      initRef.current = true;
    }

    const geometry = geometryRef.current;
    if (!geometry) return;

    // Check for new checkpoint hit
    const cp = useGameStore.getState().currentCheckpoint;
    const pos = useGameStore.getState().position;
    if (cp > lastCheckpointRef.current && lastCheckpointRef.current >= 0) {
      // Spawn burst at player position
      for (let i = 0; i < SHIMMER.PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.3) * Math.PI;
        const speed = 1 + Math.random() * SHIMMER.RISE_SPEED;
        particlesRef.current.push({
          x: pos[0] + (Math.random() - 0.5) * 2,
          y: pos[1] + Math.random() * 2,
          z: pos[2] + (Math.random() - 0.5) * 2,
          vx: Math.cos(angle) * Math.cos(elevation) * speed,
          vy: Math.abs(Math.sin(elevation)) * speed + 1,
          vz: Math.sin(angle) * Math.cos(elevation) * speed,
          life: SHIMMER.LIFE * (0.5 + Math.random() * 0.5),
        });
      }
    }
    lastCheckpointRef.current = cp;

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
    for (let i = 0; i < alive.length && i < SHIMMER.PARTICLE_COUNT; i++) {
      attr.setXYZ(i, alive[i].x, alive[i].y, alive[i].z);
    }
    attr.needsUpdate = true;
    geometry.setDrawRange(0, Math.min(alive.length, SHIMMER.PARTICLE_COUNT));
  });

  return null;
}
