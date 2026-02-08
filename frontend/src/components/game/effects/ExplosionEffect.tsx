import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Fn, instanceIndex, instancedArray, float, vec3, vec4,
  hash, uniform, deltaTime,
} from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial, BufferGeometry,
  InstancedBufferAttribute, Mesh as ThreeMesh, WebGPURenderer,
} from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import { create } from 'zustand';

const EXPLOSION = {
  PARTICLE_COUNT: 96,
  SPRITE_SIZE: 0.5,
  SPEED: 14.0,
  LIFE: 1.0,
  GRAVITY: 6.0,
  /** Max simultaneous explosions — slots are pre-allocated at mount */
  POOL_SIZE: 6,
} as const;

interface ExplosionRequest {
  id: number;
  position: [number, number, number];
  color: string;
  scale: number;
}

interface ExplosionState {
  requests: ExplosionRequest[];
  nextId: number;
  spawnExplosion: (position: [number, number, number], color: string, scale?: number) => void;
  consumeRequests: () => ExplosionRequest[];
}

export const useExplosionStore = create<ExplosionState>((set, get) => ({
  requests: [],
  nextId: 1,
  spawnExplosion: (position, color, scale = 1) => {
    const state = get();
    set({
      nextId: state.nextId + 1,
      requests: [...state.requests, { id: state.nextId, position, color, scale }],
    });
  },
  consumeRequests: () => {
    const reqs = get().requests;
    if (reqs.length === 0) return [];
    set({ requests: [] });
    return reqs;
  },
}));

/** A pre-allocated explosion slot with compiled shaders */
interface ExplosionSlot {
  mesh: ThreeMesh;
  geometry: BufferGeometry;
  material: SpriteNodeMaterial;
  computeInit: ReturnType<typeof Fn>;
  computeUpdate: ReturnType<typeof Fn>;
  emitterPos: UniformNode<unknown>;
  speed: UniformNode<unknown>;
  colorR: UniformNode<unknown>;
  colorG: UniformNode<unknown>;
  colorB: UniformNode<unknown>;
  timeAlive: number;
  active: boolean;
  computePending: boolean;
}

export function ExplosionManager() {
  const { gl, scene } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const poolRef = useRef<ExplosionSlot[]>([]);
  const readyRef = useRef(false);

  // Pre-allocate pool on mount — compile shaders ONCE
  useEffect(() => {
    const pool: ExplosionSlot[] = [];

    for (let i = 0; i < EXPLOSION.POOL_SIZE; i++) {
      const slot = createSlot();
      // Hide until activated
      slot.mesh.visible = false;
      scene.add(slot.mesh);
      pool.push(slot);
    }

    // Warm up shaders by running a dummy init on each slot
    // This forces WebGPU to compile the pipelines at load time
    const warmupPromises = pool.map((slot) =>
      renderer.computeAsync(slot.computeInit),
    );
    Promise.all(warmupPromises).then(() => {
      readyRef.current = true;
    });

    poolRef.current = pool;

    return () => {
      for (const slot of pool) {
        scene.remove(slot.mesh);
        slot.geometry.dispose();
        slot.material.dispose();
      }
      poolRef.current = [];
      readyRef.current = false;
    };
  }, [gl, scene, renderer]);

  useFrame((_, delta) => {
    if (!readyRef.current) return;
    const pool = poolRef.current;

    // Consume new explosion requests
    const requests = useExplosionStore.getState().consumeRequests();
    for (const req of requests) {
      // Find an inactive slot, or recycle the oldest active one
      let slot = pool.find((s) => !s.active);
      if (!slot) {
        let oldest: ExplosionSlot | null = null;
        for (const s of pool) {
          if (!oldest || s.timeAlive > oldest.timeAlive) oldest = s;
        }
        slot = oldest!;
      }

      // Configure slot for this explosion
      const r = parseInt(req.color.slice(1, 3), 16) / 255;
      const g = parseInt(req.color.slice(3, 5), 16) / 255;
      const b = parseInt(req.color.slice(5, 7), 16) / 255;

      slot.emitterPos.value.set(req.position[0], req.position[1], req.position[2]);
      slot.speed.value = EXPLOSION.SPEED * req.scale;
      slot.colorR.value = r;
      slot.colorG.value = g;
      slot.colorB.value = b;
      slot.timeAlive = 0;
      slot.active = true;
      slot.mesh.visible = true;
      slot.mesh.scale.setScalar(req.scale);

      // Re-init particles (no shader recompilation — same pipeline, new uniforms)
      if (!slot.computePending) {
        slot.computePending = true;
        renderer.computeAsync(slot.computeInit).then(
          () => { slot.computePending = false; },
          () => { slot.computePending = false; },
        );
      }
    }

    // Update active slots
    for (const slot of pool) {
      if (!slot.active) continue;

      slot.timeAlive += delta;
      if (slot.timeAlive > EXPLOSION.LIFE * 2) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }

      if (!slot.computePending) {
        slot.computePending = true;
        renderer.computeAsync(slot.computeUpdate).then(
          () => { slot.computePending = false; },
          () => { slot.computePending = false; },
        );
      }
    }
  });

  return null;
}

/** Create a single explosion slot with its own buffers and pre-built shaders */
function createSlot(): ExplosionSlot {
  const count = EXPLOSION.PARTICLE_COUNT;
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const lifeBuffer = instancedArray(count, 'float');

  // Mutable uniforms — updated per-explosion without recompilation
  const emitterPos = uniform(vec3(0, -1000, 0));
  const speed = uniform(float(EXPLOSION.SPEED));
  const colorR = uniform(float(1));
  const colorG = uniform(float(0.4));
  const colorB = uniform(float(0));

  const colorNode = vec3(colorR, colorG, colorB);

  // Init: scatter particles from emitter
  const computeInit = Fn(() => {
    const idx = instanceIndex;
    const seed = idx.toFloat().mul(0.789);
    const rx = hash(seed).sub(0.5).mul(2);
    const ry = hash(seed.add(1)).sub(0.5).mul(2);
    const rz = hash(seed.add(2)).sub(0.5).mul(2);
    const len = rx.mul(rx).add(ry.mul(ry)).add(rz.mul(rz)).sqrt().max(0.01);
    positionBuffer.element(idx).assign(emitterPos);
    velocityBuffer.element(idx).assign(vec3(
      rx.div(len).mul(speed).mul(hash(seed.add(3)).mul(0.7).add(0.3)),
      ry.div(len).mul(speed).mul(hash(seed.add(4)).mul(0.7).add(0.3)).add(float(4)),
      rz.div(len).mul(speed).mul(hash(seed.add(5)).mul(0.7).add(0.3)),
    ));
    lifeBuffer.element(idx).assign(float(EXPLOSION.LIFE).mul(hash(seed.add(6)).mul(0.5).add(0.5)));
  })().compute(count);

  // Update: move + gravity + decay
  const computeUpdate = Fn(() => {
    const idx = instanceIndex;
    const pos = positionBuffer.element(idx).toVar();
    const vel = velocityBuffer.element(idx).toVar();
    const life = lifeBuffer.element(idx).toVar();
    life.subAssign(deltaTime);
    vel.y.subAssign(float(EXPLOSION.GRAVITY).mul(deltaTime));
    vel.mulAssign(float(1).sub(deltaTime.mul(2))); // drag
    pos.addAssign(vel.mul(deltaTime));
    positionBuffer.element(idx).assign(pos);
    velocityBuffer.element(idx).assign(vel);
    lifeBuffer.element(idx).assign(life);
  })().compute(count);

  const geometry = new BufferGeometry();
  const posArray = new Float32Array(count * 3);
  geometry.setAttribute('position', new InstancedBufferAttribute(posArray, 3));

  const material = new SpriteNodeMaterial();
  material.positionNode = positionBuffer.toAttribute();
  material.colorNode = vec4(colorNode.mul(float(4)), lifeBuffer.toAttribute().div(EXPLOSION.LIFE).clamp(0, 1));
  material.scaleNode = uniform(EXPLOSION.SPRITE_SIZE);
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;

  const mesh = new ThreeMesh(geometry, material);
  mesh.count = count;
  mesh.frustumCulled = false;

  return {
    mesh,
    geometry,
    material,
    computeInit,
    computeUpdate,
    emitterPos,
    speed,
    colorR,
    colorG,
    colorB,
    timeAlive: 0,
    active: false,
    computePending: false,
  };
}
