/**
 * GPU particle emitter — compute-shader driven point particles with
 * emissive additive sprites. Single draw call for all particles.
 *
 * Depends on: gpuParticleCompute, three/webgpu, settingsStore
 * Used by: Game effects (explosions, ambient particles)
 */
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { vec4, uniform } from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial, BufferGeometry,
  InstancedBufferAttribute, Mesh as ThreeMesh,
} from 'three/webgpu';
import { useSettingsStore } from '../stores/settingsStore';
import { devLog, frameTiming } from '../stores/devLogStore';
import { createComputeNodes } from './gpuParticleCompute';

const SPRITE_SIZE = 0.15;

interface GpuParticlesProps {
  count: number;
  position: [number, number, number];
  color: string;
  spread?: number;
  speed?: number;
  direction?: [number, number, number];
}

export function GpuParticles({
  count,
  position,
  color,
  spread = 1.0,
  speed = 2.0,
  direction = [0, 1, 0],
}: GpuParticlesProps) {
  const { gl, scene } = useThree();
  const meshRef = useRef<ThreeMesh | null>(null);
  const initializedRef = useRef(false);
  const computeUpdateRef = useRef<ReturnType<typeof createComputeNodes> | null>(null);

  useEffect(() => {
    const particles = useSettingsStore.getState().particles;
    if (!particles) return;

    const nodes = createComputeNodes(count, position, color, spread, speed, direction);
    computeUpdateRef.current = nodes;

    const geometry = new BufferGeometry();
    const posArray = new Float32Array(count * 3);
    geometry.setAttribute('position', new InstancedBufferAttribute(posArray, 3));

    const material = new SpriteNodeMaterial();
    material.positionNode = nodes.positionBuffer.toAttribute();
    material.colorNode = vec4(nodes.colorNode, nodes.lifeBuffer.toAttribute().clamp(0, 1));
    material.scaleNode = uniform(SPRITE_SIZE);
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = count;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshRef.current = mesh;

    const renderer = gl as unknown as import('three/webgpu').WebGPURenderer;
    devLog.info('Particles', `Initializing ${count} GPU particles via compute shader`);
    renderer.computeAsync(nodes.computeInit).then(() => {
      initializedRef.current = true;
      devLog.success('Particles', `${count} particles active at [${position.join(', ')}]`);
    });

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
      initializedRef.current = false;
      computeUpdateRef.current = null;
    };
  }, [gl, scene, count, position, color, spread, speed, direction]);

  useFrame(() => {
    if (!initializedRef.current || !computeUpdateRef.current) return;
    const particles = useSettingsStore.getState().particles;
    if (!particles) return;

    frameTiming.begin('Particles');
    const renderer = gl as unknown as import('three/webgpu').WebGPURenderer;
    renderer.compute(computeUpdateRef.current.computeUpdate);
    frameTiming.end('Particles');
  });

  return null;
}
