/**
 * EnvironmentalParticles — Ambient GPU particle effect driven by presets.
 *
 * Renders persistent environmental particles (snow, ash, pollen, dust motes)
 * that follow the camera within a configurable volume. Uses TSL compute shaders
 * with gravity, drag, and wind support. Particles that exit the volume are
 * respawned at the opposite side for seamless looping.
 *
 * Uses instancedArray + compute (same pattern as GpuParticles/ExplosionEffect).
 * Single draw call for all particles. Prop-driven — no game store imports.
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Fn, instanceIndex, instancedArray, float, vec3, vec4,
  hash, uniform, deltaTime,
} from 'three/tsl';
import {
  AdditiveBlending, NormalBlending, SpriteNodeMaterial, BufferGeometry,
  InstancedBufferAttribute, Mesh as ThreeMesh, WebGPURenderer,
} from 'three/webgpu';
import { Vector3 } from 'three';
import { useSettingsStore } from '../stores/settingsStore';
import { devLog } from '../stores/devLogStore';
import type { ParticlePreset } from './particlePresets';

interface EnvironmentalParticlesProps {
  /** Particle preset configuration */
  preset: ParticlePreset;
  /** Wind direction+strength override [x, y, z] (added to velocity each frame) */
  wind?: [number, number, number];
  /** Whether to use additive blending (true) or normal blending (false). Default: false */
  additive?: boolean;
}

export function EnvironmentalParticles({
  preset,
  wind = [0, 0, 0],
  additive = false,
}: EnvironmentalParticlesProps) {
  const { gl, scene, camera } = useThree();
  const meshRef = useRef<ThreeMesh | null>(null);
  const readyRef = useRef(false);
  const computeUpdateRef = useRef<ReturnType<typeof Fn> | null>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Uniform refs for camera-follow
  const emitterPosRef = useRef(uniform(new Vector3()));
  const windRef = useRef(uniform(vec3(wind[0], wind[1], wind[2])));

  useEffect(() => {
    if (!useSettingsStore.getState().particles) return;

    const count = preset.count;
    const renderer = gl as unknown as WebGPURenderer;

    const positionBuffer = instancedArray(count, 'vec3');
    const velocityBuffer = instancedArray(count, 'vec3');
    const lifeBuffer = instancedArray(count, 'float');

    const emitterPos = emitterPosRef.current;
    const spreadU = uniform(float(preset.spread));
    const speedU = uniform(float(preset.speed));
    const dirU = uniform(vec3(preset.direction[0], preset.direction[1], preset.direction[2]));
    const gravityU = uniform(float(preset.gravity));
    const dragU = uniform(float(preset.drag));
    const windU = windRef.current;
    const minLife = preset.lifetime[0];
    const maxLife = preset.lifetime[1];
    const lifeRange = maxLife - minLife;

    // Init: scatter particles randomly in volume around emitter
    const computeInit = Fn(() => {
      const idx = instanceIndex;
      const seed = idx.toFloat().mul(0.321);

      const rx = hash(seed).sub(0.5).mul(2).mul(spreadU);
      const ry = hash(seed.add(1.0)).sub(0.5).mul(2).mul(spreadU);
      const rz = hash(seed.add(2.0)).sub(0.5).mul(2).mul(spreadU);

      positionBuffer.element(idx).assign(emitterPos.add(vec3(rx, ry, rz)));

      // Direction-based velocity with randomized speed
      const speedVar = hash(seed.add(6.0)).mul(0.6).add(0.7); // 0.7-1.3
      const vx = dirU.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const vy = dirU.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const vz = dirU.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      velocityBuffer.element(idx).assign(vec3(vx, vy, vz));

      // Random initial life phase to stagger respawns
      lifeBuffer.element(idx).assign(
        hash(seed.add(7.0)).mul(float(lifeRange)).add(float(minLife)),
      );
    })().compute(count);

    // Update: move, apply gravity/drag/wind, respawn dead
    const computeUpdate = Fn(() => {
      const idx = instanceIndex;
      const pos = positionBuffer.element(idx).toVar();
      const vel = velocityBuffer.element(idx).toVar();
      const life = lifeBuffer.element(idx).toVar();

      life.subAssign(deltaTime);

      // Apply gravity (positive = downward pull)
      vel.y.subAssign(gravityU.mul(deltaTime));

      // Apply drag
      vel.mulAssign(float(1).sub(dragU.mul(deltaTime)));

      // Apply wind
      vel.addAssign(windU.mul(deltaTime));

      // Move
      pos.addAssign(vel.mul(deltaTime));

      // Respawn if dead
      const seed = idx.toFloat().mul(0.654).add(life);
      const dead = life.lessThan(0.0);

      const newRx = hash(seed).sub(0.5).mul(2).mul(spreadU);
      const newRy = hash(seed.add(1.0)).sub(0.5).mul(2).mul(spreadU);
      const newRz = hash(seed.add(2.0)).sub(0.5).mul(2).mul(spreadU);
      const newPos = emitterPos.add(vec3(newRx, newRy, newRz));

      const speedVar = hash(seed.add(6.0)).mul(0.6).add(0.7);
      const nvx = dirU.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const nvy = dirU.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const nvz = dirU.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const newVel = vec3(nvx, nvy, nvz);

      const newLife = hash(seed.add(7.0)).mul(float(lifeRange)).add(float(minLife));

      pos.assign(dead.select(newPos, pos));
      vel.assign(dead.select(newVel, vel));
      life.assign(dead.select(newLife, life));

      positionBuffer.element(idx).assign(pos);
      velocityBuffer.element(idx).assign(vel);
      lifeBuffer.element(idx).assign(life);
    })().compute(count);

    computeUpdateRef.current = computeUpdate;

    // Parse preset color
    const cr = parseInt(preset.color.slice(1, 3), 16) / 255;
    const cg = parseInt(preset.color.slice(3, 5), 16) / 255;
    const cb = parseInt(preset.color.slice(5, 7), 16) / 255;
    const colorNode = vec3(float(cr), float(cg), float(cb));

    // Alpha from life remaining
    const lifeFrac = lifeBuffer.toAttribute().div(float(maxLife)).clamp(0, 1);

    const geometry = new BufferGeometry();
    const posArray = new Float32Array(count * 3);
    geometry.setAttribute('position', new InstancedBufferAttribute(posArray, 3));

    const material = new SpriteNodeMaterial();
    material.positionNode = positionBuffer.toAttribute();
    material.colorNode = vec4(colorNode, lifeFrac.mul(0.8));
    material.scaleNode = uniform(preset.spriteSize);
    material.transparent = true;
    material.blending = additive ? AdditiveBlending : NormalBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.name = `EnvParticles_${preset.name}`;
    scene.add(mesh);
    meshRef.current = mesh;

    // Warm up compute pipeline
    readyRef.current = false;
    emitterPos.value.copy(cameraRef.current.position);
    renderer.computeAsync(computeInit).then(() => {
      readyRef.current = true;
      devLog.success('EnvParticles', `${preset.name}: ${count} particles active`);
    }).catch((err) => {
      devLog.error('EnvParticles', `${preset.name} init failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
      readyRef.current = false;
      computeUpdateRef.current = null;
    };
    // Preset identity: rebuild when preset object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, preset, additive]);

  // Update wind uniform when prop changes
  useEffect(() => {
    windRef.current.value.set(wind[0], wind[1], wind[2]);
  }, [wind]);

  useFrame(() => {
    if (!readyRef.current || !computeUpdateRef.current) return;
    if (!useSettingsStore.getState().particles) return;

    // Follow camera — particles spawn around player
    emitterPosRef.current.value.copy(cameraRef.current.position);

    const renderer = gl as unknown as WebGPURenderer;
    renderer.compute(computeUpdateRef.current);
  });

  return null;
}
