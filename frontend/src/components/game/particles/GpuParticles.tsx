import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  Fn, instanceIndex, instancedArray, float, vec3, vec4,
  hash, uniform, deltaTime, storage,
} from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial, BufferGeometry,
  InstancedBufferAttribute, Mesh as ThreeMesh,
} from 'three/webgpu';
import { useSettingsStore } from '../../../stores/settingsStore';
import { devLog } from '../../../stores/devLogStore';

const PARTICLES = {
  SPRITE_SIZE: 0.15,
  MIN_LIFE: 0.3,
  MAX_LIFE: 1.5,
} as const;

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

    // Create sprite geometry with instance count
    const geometry = new BufferGeometry();
    // Minimal quad vertices for sprite
    const posArray = new Float32Array(count * 3);
    geometry.setAttribute('position', new InstancedBufferAttribute(posArray, 3));

    const material = new SpriteNodeMaterial();
    material.positionNode = nodes.positionBuffer.toAttribute();
    material.colorNode = vec4(nodes.colorNode, nodes.lifeBuffer.toAttribute().clamp(0, 1));
    material.scaleNode = uniform(PARTICLES.SPRITE_SIZE);
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = count;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshRef.current = mesh;

    // Run init compute
    const renderer = gl as import('three/webgpu').WebGPURenderer;
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

    const renderer = gl as import('three/webgpu').WebGPURenderer;
    renderer.computeAsync(computeUpdateRef.current.computeUpdate);
  });

  return null;
}

function createComputeNodes(
  count: number,
  emitterPos: [number, number, number],
  _color: string,
  spread: number,
  speed: number,
  dir: [number, number, number],
) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const lifeBuffer = instancedArray(count, 'float');

  const emitterPosition = uniform(vec3(emitterPos[0], emitterPos[1], emitterPos[2]));
  const emitterDirection = uniform(vec3(dir[0], dir[1], dir[2]));
  const particleSpeed = uniform(float(speed));
  const particleSpread = uniform(float(spread));

  const colorNode = vec3(
    float(parseInt(_color.slice(1, 3), 16) / 255),
    float(parseInt(_color.slice(3, 5), 16) / 255),
    float(parseInt(_color.slice(5, 7), 16) / 255),
  );

  // Init: randomize particle positions around emitter
  const computeInit = Fn(() => {
    const idx = instanceIndex;
    const seed = idx.toFloat().mul(0.123);

    const rx = hash(seed).sub(0.5).mul(particleSpread);
    const ry = hash(seed.add(1.0)).sub(0.5).mul(particleSpread);
    const rz = hash(seed.add(2.0)).sub(0.5).mul(particleSpread);

    positionBuffer.element(idx).assign(emitterPosition.add(vec3(rx, ry, rz)));

    const vx = emitterDirection.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const vy = emitterDirection.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const vz = emitterDirection.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    velocityBuffer.element(idx).assign(vec3(vx, vy, vz));

    // Random initial life phase
    lifeBuffer.element(idx).assign(
      hash(seed.add(6.0)).mul(PARTICLES.MAX_LIFE - PARTICLES.MIN_LIFE).add(PARTICLES.MIN_LIFE),
    );
  })().compute(count);

  // Update: move particles, decay life, respawn dead ones
  const computeUpdate = Fn(() => {
    const idx = instanceIndex;
    const pos = positionBuffer.element(idx).toVar();
    const vel = velocityBuffer.element(idx).toVar();
    const life = lifeBuffer.element(idx).toVar();

    // Decay life
    life.subAssign(deltaTime);

    // Respawn if dead
    const seed = idx.toFloat().mul(0.456).add(life);
    const shouldRespawn = life.lessThan(0.0);

    // New position at emitter
    const newX = emitterPosition.x.add(hash(seed).sub(0.5).mul(particleSpread));
    const newY = emitterPosition.y.add(hash(seed.add(1.0)).sub(0.5).mul(particleSpread));
    const newZ = emitterPosition.z.add(hash(seed.add(2.0)).sub(0.5).mul(particleSpread));

    pos.assign(shouldRespawn.select(vec3(newX, newY, newZ), pos.add(vel.mul(deltaTime))));

    // New velocity
    const nvx = emitterDirection.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const nvy = emitterDirection.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.5)).mul(particleSpeed);
    const nvz = emitterDirection.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.5)).mul(particleSpeed);

    vel.assign(shouldRespawn.select(vec3(nvx, nvy, nvz), vel));

    // Reset life
    const newLife = hash(seed.add(6.0)).mul(PARTICLES.MAX_LIFE - PARTICLES.MIN_LIFE).add(PARTICLES.MIN_LIFE);
    life.assign(shouldRespawn.select(newLife, life));

    positionBuffer.element(idx).assign(pos);
    velocityBuffer.element(idx).assign(vel);
    lifeBuffer.element(idx).assign(life);
  })().compute(count);

  return { positionBuffer, velocityBuffer, lifeBuffer, colorNode, computeInit, computeUpdate };
}
