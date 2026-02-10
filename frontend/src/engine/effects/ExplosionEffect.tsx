/**
 * GPU-efficient explosion particle system — single instanced sprite mesh for
 * ALL explosions. CPU updates particles, instancedDynamicBufferAttribute for
 * per-frame transfer, partial buffer uploads. 1 draw call total.
 *
 * Depends on: R3F, three/tsl, explosion/ modules (config, store, particles)
 * Used by: GameCanvas (3D scene)
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { float, vec4, instancedDynamicBufferAttribute } from 'three/tsl';
import { AdditiveBlending, SpriteNodeMaterial, Mesh as ThreeMesh } from 'three/webgpu';
import { BufferGeometry, InstancedBufferAttribute } from 'three';
import { devLog, frameTiming } from '../stores/devLogStore';
import { EXPLOSION, TOTAL_PARTICLES, type ParticleArrays, type SlotState } from './explosion/explosionConfig';
import { useExplosionStore } from './explosion/explosionStore';
import { ensureRandomTables, createParticleArrays, createSlots, spawnIntoSlot, updateSlots } from './explosion/explosionParticles';

export { useExplosionStore } from './explosion/explosionStore';

export function ExplosionManager() {
  const { scene } = useThree();
  const slotsRef = useRef<SlotState[]>([]);
  const particlesRef = useRef<ParticleArrays | null>(null);
  const gpuPosRef = useRef<Float32Array | null>(null);
  const gpuColorRef = useRef<Float32Array | null>(null);
  const gpuScaleRef = useRef<Float32Array | null>(null);
  const posAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const scaleAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const meshRef = useRef<ThreeMesh | null>(null);

  useEffect(() => {
    ensureRandomTables();

    particlesRef.current = createParticleArrays();
    slotsRef.current = createSlots();

    const gpuPos = new Float32Array(TOTAL_PARTICLES * 3);
    const gpuColor = new Float32Array(TOTAL_PARTICLES * 4);
    const gpuScale = new Float32Array(TOTAL_PARTICLES);
    for (let i = 0; i < TOTAL_PARTICLES; i++) gpuPos[i * 3 + 1] = EXPLOSION.HIDDEN_Y;

    gpuPosRef.current = gpuPos;
    gpuColorRef.current = gpuColor;
    gpuScaleRef.current = gpuScale;

    const posAttr = new InstancedBufferAttribute(gpuPos, 3);
    const colorAttr = new InstancedBufferAttribute(gpuColor, 4);
    const scaleAttr = new InstancedBufferAttribute(gpuScale, 1);
    posAttrRef.current = posAttr;
    colorAttrRef.current = colorAttr;
    scaleAttrRef.current = scaleAttr;

    const posNode = instancedDynamicBufferAttribute(posAttr, 'vec3');
    const colorNode = instancedDynamicBufferAttribute(colorAttr, 'vec4');
    const scaleNode = instancedDynamicBufferAttribute(scaleAttr, 'float');

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', posAttr);

    const material = new SpriteNodeMaterial();
    material.positionNode = posNode;
    material.colorNode = vec4(colorNode.xyz.mul(float(EXPLOSION.EMISSIVE_MULT)), colorNode.w);
    material.scaleNode = scaleNode;
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = TOTAL_PARTICLES;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshRef.current = mesh;

    devLog.success('Explosion', `Pool ready: ${EXPLOSION.POOL_SIZE} slots x ${EXPLOSION.PARTICLE_COUNT} = ${TOTAL_PARTICLES} (1 draw call)`);

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
      particlesRef.current = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    const particles = particlesRef.current;
    if (!particles || !meshRef.current) return;

    const gpuPos = gpuPosRef.current!;
    const gpuColor = gpuColorRef.current!;
    const gpuScale = gpuScaleRef.current!;
    const posAttr = posAttrRef.current!;
    const colorAttr = colorAttrRef.current!;
    const scaleAttr = scaleAttrRef.current!;
    const slots = slotsRef.current;

    frameTiming.begin('Explosions');

    // Spawn
    const requests = useExplosionStore.getState().consumeRequests();
    for (const req of requests) {
      spawnIntoSlot(slots, particles, gpuScale, req);
    }
    if (requests.length > 0) devLog.info('Explosion', `Spawned ${requests.length}`);

    // Update
    const dt = Math.min(delta, 0.05);
    const dirty = updateSlots(slots, particles, gpuPos, gpuColor, gpuScale, dt);

    // Partial GPU upload
    if (dirty.max > dirty.min) {
      const rangeCount = dirty.max - dirty.min;
      posAttr.clearUpdateRanges();
      posAttr.addUpdateRange(dirty.min * 3, rangeCount * 3);
      posAttr.needsUpdate = true;
      colorAttr.clearUpdateRanges();
      colorAttr.addUpdateRange(dirty.min * 4, rangeCount * 4);
      colorAttr.needsUpdate = true;
      scaleAttr.clearUpdateRanges();
      scaleAttr.addUpdateRange(dirty.min, rangeCount);
      scaleAttr.needsUpdate = true;
    }

    frameTiming.end('Explosions');
  });

  return null;
}
