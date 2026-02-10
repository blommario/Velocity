import { useRef, useEffect, useMemo } from 'react';
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
import { PARTICLE_PRESETS, type ParticlePreset } from './particlePresets';
import type { ParticleEmitterData } from '../types/map';

interface ParticleEmitterProps {
  data: ParticleEmitterData;
}

export function ParticleEmitter({ data }: ParticleEmitterProps) {
  const { gl } = useThree();
  const readyRef = useRef(false);
  const computeUpdateRef = useRef<ReturnType<typeof Fn> | null>(null);

  // Uniform refs for mutable props (wind, position) — survive across renders
  const emitterPosRef = useRef(uniform(new Vector3(data.position[0], data.position[1], data.position[2])));
  const windRef = useRef(uniform(vec3(data.wind?.[0] ?? 0, data.wind?.[1] ?? 0, data.wind?.[2] ?? 0)));

  // Merge preset with overrides
  const preset = useMemo((): ParticlePreset => {
    const base = PARTICLE_PRESETS[data.preset];
    return {
      ...base,
      count: data.count ?? base.count,
      spread: data.spread ?? base.spread,
      color: data.color ?? base.color,
    };
  }, [data.preset, data.count, data.spread, data.color]);

  // Build mesh + compute pipeline once per structural change (preset/count/color)
  const mesh = useMemo(() => {
    if (!useSettingsStore.getState().particles) return null;

    const count = preset.count;

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

    // Init: scatter particles around emitter
    const computeInit = Fn(() => {
      const idx = instanceIndex;
      const seed = idx.toFloat().mul(0.321);

      const rx = hash(seed).sub(0.5).mul(2).mul(spreadU);
      const ry = hash(seed.add(1.0)).sub(0.5).mul(spreadU);
      const rz = hash(seed.add(2.0)).sub(0.5).mul(2).mul(spreadU);

      positionBuffer.element(idx).assign(emitterPos.add(vec3(rx, ry, rz)));

      const speedVar = hash(seed.add(6.0)).mul(0.6).add(0.7);
      const vx = dirU.x.add(hash(seed.add(3.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const vy = dirU.y.add(hash(seed.add(4.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      const vz = dirU.z.add(hash(seed.add(5.0)).sub(0.5).mul(0.3)).mul(speedU).mul(speedVar);
      velocityBuffer.element(idx).assign(vec3(vx, vy, vz));

      lifeBuffer.element(idx).assign(
        hash(seed.add(7.0)).mul(float(lifeRange)).add(float(minLife)),
      );
    })().compute(count);

    // Update: physics + respawn
    const computeUpdate = Fn(() => {
      const idx = instanceIndex;
      const pos = positionBuffer.element(idx).toVar();
      const vel = velocityBuffer.element(idx).toVar();
      const life = lifeBuffer.element(idx).toVar();

      life.subAssign(deltaTime);

      vel.y.subAssign(gravityU.mul(deltaTime));
      vel.mulAssign(float(1).sub(dragU.mul(deltaTime)));
      vel.addAssign(windU.mul(deltaTime));
      pos.addAssign(vel.mul(deltaTime));

      // Respawn dead particles at emitter
      const seed = idx.toFloat().mul(0.654).add(life);
      const dead = life.lessThan(0.0);

      const newRx = hash(seed).sub(0.5).mul(2).mul(spreadU);
      const newRy = hash(seed.add(1.0)).sub(0.5).mul(spreadU);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/three ComputeNode gap
    computeUpdateRef.current = computeUpdate as any;

    // Parse color
    const cr = parseInt(preset.color.slice(1, 3), 16) / 255;
    const cg = parseInt(preset.color.slice(3, 5), 16) / 255;
    const cb = parseInt(preset.color.slice(5, 7), 16) / 255;
    const colorNode = vec3(float(cr), float(cg), float(cb));

    const lifeFrac = lifeBuffer.toAttribute().div(float(maxLife)).clamp(0, 1);

    const geometry = new BufferGeometry();
    const posArray = new Float32Array(count * 3);
    geometry.setAttribute('position', new InstancedBufferAttribute(posArray, 3));

    const useAdditive = data.preset === 'sparks' || data.preset === 'ash' || data.preset === 'trail';

    const material = new SpriteNodeMaterial();
    material.positionNode = positionBuffer.toAttribute();
    material.colorNode = vec4(colorNode, lifeFrac.mul(0.8));
    material.scaleNode = uniform(preset.spriteSize);
    material.transparent = true;
    material.blending = useAdditive ? AdditiveBlending : NormalBlending;
    material.depthWrite = false;

    const m = new ThreeMesh(geometry, material);
    m.count = count;
    m.frustumCulled = false;
    m.name = `Emitter_${data.preset}`;

    // Warm up compute pipeline
    readyRef.current = false;
    const renderer = gl as unknown as WebGPURenderer;
    renderer.computeAsync(computeInit).then(() => {
      readyRef.current = true;
      devLog.success('Emitter', `${data.preset}: ${count} particles at [${data.position.join(', ')}]`);
    }).catch((err) => {
      devLog.error('Emitter', `${data.preset} init failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, preset]);

  // Dispose resources on unmount or rebuild
  useEffect(() => {
    return () => {
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as SpriteNodeMaterial).dispose();
      }
      readyRef.current = false;
      computeUpdateRef.current = null;
    };
  }, [mesh]);

  // Update mutable uniforms without pipeline rebuild
  useEffect(() => {
    emitterPosRef.current.value.set(data.position[0], data.position[1], data.position[2]);
  }, [data.position]);

  useEffect(() => {
    const w = data.wind ?? [0, 0, 0];
    windRef.current.value.set(w[0], w[1], w[2]);
  }, [data.wind]);

  useFrame(() => {
    if (!readyRef.current || !computeUpdateRef.current) return;
    if (!useSettingsStore.getState().particles) return;

    const renderer = gl as unknown as WebGPURenderer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/three ComputeNode gap
    renderer.compute(computeUpdateRef.current as any);
  });

  if (!mesh) return null;
  return <primitive object={mesh} />;
}
