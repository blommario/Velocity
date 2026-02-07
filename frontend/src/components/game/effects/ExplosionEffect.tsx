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
import { create } from 'zustand';

const EXPLOSION = {
  PARTICLE_COUNT: 64,
  SPRITE_SIZE: 0.25,
  SPEED: 8.0,
  LIFE: 0.6,
  GRAVITY: 5.0,
  MAX_ACTIVE: 8,
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

interface ActiveExplosion {
  id: number;
  mesh: ThreeMesh;
  geometry: BufferGeometry;
  material: SpriteNodeMaterial;
  computeUpdate: ReturnType<typeof Fn>;
  timeAlive: number;
}

export function ExplosionManager() {
  const { gl, scene } = useThree();
  const renderer = gl as unknown as WebGPURenderer;
  const activeRef = useRef<ActiveExplosion[]>([]);

  useFrame((_, delta) => {
    // Consume new explosion requests
    const requests = useExplosionStore.getState().consumeRequests();
    for (const req of requests) {
      if (activeRef.current.length >= EXPLOSION.MAX_ACTIVE) {
        // Remove oldest
        const oldest = activeRef.current.shift();
        if (oldest) {
          scene.remove(oldest.mesh);
          oldest.geometry.dispose();
          oldest.material.dispose();
        }
      }
      spawnExplosion(req, scene, renderer, activeRef);
    }

    // Update active explosions
    const toRemove: number[] = [];
    for (const exp of activeRef.current) {
      exp.timeAlive += delta;
      if (exp.timeAlive > EXPLOSION.LIFE * 2) {
        toRemove.push(exp.id);
        scene.remove(exp.mesh);
        exp.geometry.dispose();
        exp.material.dispose();
      } else {
        renderer.computeAsync(exp.computeUpdate);
      }
    }

    if (toRemove.length > 0) {
      activeRef.current = activeRef.current.filter((e) => !toRemove.includes(e.id));
    }
  });

  return null;
}

function spawnExplosion(
  req: ExplosionRequest,
  scene: import('three').Scene,
  renderer: WebGPURenderer,
  activeRef: React.MutableRefObject<ActiveExplosion[]>,
) {
  const count = EXPLOSION.PARTICLE_COUNT;
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const lifeBuffer = instancedArray(count, 'float');

  const emitterPos = uniform(vec3(req.position[0], req.position[1], req.position[2]));
  const speed = uniform(float(EXPLOSION.SPEED * req.scale));

  const r = parseInt(req.color.slice(1, 3), 16) / 255;
  const g = parseInt(req.color.slice(3, 5), 16) / 255;
  const b = parseInt(req.color.slice(5, 7), 16) / 255;
  const colorNode = vec3(float(r), float(g), float(b));

  // Init: scatter from center
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
      ry.div(len).mul(speed).mul(hash(seed.add(4)).mul(0.7).add(0.3)).add(float(2)),
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
    vel.mulAssign(float(1).sub(deltaTime.mul(2)));  // drag
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
  material.colorNode = vec4(colorNode.mul(float(2)), lifeBuffer.toAttribute().div(EXPLOSION.LIFE).clamp(0, 1));
  material.scaleNode = uniform(EXPLOSION.SPRITE_SIZE * req.scale);
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;

  const mesh = new ThreeMesh(geometry, material);
  mesh.count = count;
  mesh.frustumCulled = false;
  scene.add(mesh);

  renderer.computeAsync(computeInit);

  activeRef.current.push({
    id: req.id,
    mesh,
    geometry,
    material,
    computeUpdate,
    timeAlive: 0,
  });
}
