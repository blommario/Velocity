/**
 * GPU-efficient explosion particle system using CPU→GPU pattern.
 *
 * Same architecture as GpuProjectiles:
 * - Single instanced sprite mesh for ALL explosion particles across ALL slots
 * - CPU updates particle positions/velocities/life in flat Float32Arrays
 * - instancedDynamicBufferAttribute for efficient per-frame CPU→GPU transfer
 * - ZERO renderer.compute() calls — all physics on CPU (trivial for particles)
 * - Partial buffer uploads via addUpdateRange() — only touched slots uploaded
 *
 * Total: 1 draw call for ALL explosions regardless of count.
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { float, vec4, instancedDynamicBufferAttribute } from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial,
  Mesh as ThreeMesh,
} from 'three/webgpu';
import { BufferGeometry, InstancedBufferAttribute, Color } from 'three';
import { create } from 'zustand';
import { devLog, frameTiming } from '../stores/devLogStore';

const EXPLOSION = {
  PARTICLE_COUNT: 384,
  SPRITE_SIZE: 0.9,
  SPEED: 24.0,
  LIFE: 1.5,
  GRAVITY: 4.0,
  EMISSIVE_MULT: 4.0,
  /** Max simultaneous explosions — slots are pre-allocated at mount */
  POOL_SIZE: 8,
  /** Hidden Y for inactive sprites */
  HIDDEN_Y: -9999,
  /** Max queued requests to avoid memory spikes */
  MAX_REQUESTS: 16,
} as const;

/** Total sprite instances across all slots */
const TOTAL_PARTICLES = EXPLOSION.POOL_SIZE * EXPLOSION.PARTICLE_COUNT;

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
    const current = get().requests;
    if (current.length >= EXPLOSION.MAX_REQUESTS) return;
    set((state) => ({
      nextId: state.nextId + 1,
      requests: [...state.requests, { id: state.nextId, position, color, scale }],
    }));
  },
  consumeRequests: () => {
    const reqs = get().requests;
    if (reqs.length === 0) return [];
    set({ requests: [] });
    return reqs;
  },
}));

/**
 * CPU-side particle state — mutable in-place, zero GC.
 * Flat arrays indexed by global particle index.
 */
interface ParticleArrays {
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
}

interface SlotState {
  active: boolean;
  /** Set true when slot just died — triggers one-time GPU zero-out */
  needsCleanup: boolean;
  timeAlive: number;
  scale: number;
  colorR: number;
  colorG: number;
  colorB: number;
}

// Reusable Color for hex parsing
const _tempColor = new Color();

// Pre-computed random tables (deterministic, built once)
let _randomDirs: Float32Array | null = null;
let _randomSpeeds: Float32Array | null = null;
let _randomLifeMults: Float32Array | null = null;

function ensureRandomTables() {
  if (_randomDirs) return;
  const count = EXPLOSION.PARTICLE_COUNT;
  _randomDirs = new Float32Array(count * 3);
  _randomSpeeds = new Float32Array(count);
  _randomLifeMults = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const seed = i * 0.789;
    const rx = fract(Math.sin(seed * 127.1) * 43758.5453) * 2 - 1;
    const ry = fract(Math.sin((seed + 1) * 127.1) * 43758.5453) * 2 - 1;
    const rz = fract(Math.sin((seed + 2) * 127.1) * 43758.5453) * 2 - 1;
    const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 0.01;
    _randomDirs[i * 3] = rx / len;
    _randomDirs[i * 3 + 1] = ry / len;
    _randomDirs[i * 3 + 2] = rz / len;
    _randomSpeeds[i] = fract(Math.sin((seed + 3) * 127.1) * 43758.5453) * 0.7 + 0.3;
    _randomLifeMults[i] = fract(Math.sin((seed + 6) * 127.1) * 43758.5453) * 0.5 + 0.5;
  }
}

function fract(x: number): number {
  return x - Math.floor(x);
}

export function ExplosionManager() {
  const { scene } = useThree();
  const slotsRef = useRef<SlotState[]>([]);
  const particlesRef = useRef<ParticleArrays | null>(null);

  // GPU buffer data
  const gpuPosRef = useRef<Float32Array | null>(null);
  const gpuColorRef = useRef<Float32Array | null>(null);
  const gpuScaleRef = useRef<Float32Array | null>(null);

  // InstancedBufferAttribute refs for partial update
  const posAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const scaleAttrRef = useRef<InstancedBufferAttribute | null>(null);

  const meshRef = useRef<ThreeMesh | null>(null);

  useEffect(() => {
    ensureRandomTables();

    // Pre-allocate CPU particle arrays
    const particles: ParticleArrays = {
      posX: new Float32Array(TOTAL_PARTICLES),
      posY: new Float32Array(TOTAL_PARTICLES),
      posZ: new Float32Array(TOTAL_PARTICLES),
      velX: new Float32Array(TOTAL_PARTICLES),
      velY: new Float32Array(TOTAL_PARTICLES),
      velZ: new Float32Array(TOTAL_PARTICLES),
      life: new Float32Array(TOTAL_PARTICLES),
      maxLife: new Float32Array(TOTAL_PARTICLES),
    };
    particles.posY.fill(EXPLOSION.HIDDEN_Y);
    particlesRef.current = particles;

    // Pre-allocate slot states
    const slots: SlotState[] = [];
    for (let i = 0; i < EXPLOSION.POOL_SIZE; i++) {
      slots.push({
        active: false,
        needsCleanup: false,
        timeAlive: 0,
        scale: 1,
        colorR: 1,
        colorG: 0.4,
        colorB: 0,
      });
    }
    slotsRef.current = slots;

    // GPU buffer arrays: position (vec3), color (vec4 RGBA), scale (float)
    const gpuPos = new Float32Array(TOTAL_PARTICLES * 3);
    const gpuColor = new Float32Array(TOTAL_PARTICLES * 4);
    const gpuScale = new Float32Array(TOTAL_PARTICLES);

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      gpuPos[i * 3 + 1] = EXPLOSION.HIDDEN_Y;
    }

    gpuPosRef.current = gpuPos;
    gpuColorRef.current = gpuColor;
    gpuScaleRef.current = gpuScale;

    // Standard InstancedBufferAttributes
    const posAttr = new InstancedBufferAttribute(gpuPos, 3);
    const colorAttr = new InstancedBufferAttribute(gpuColor, 4);
    const scaleAttr = new InstancedBufferAttribute(gpuScale, 1);

    posAttrRef.current = posAttr;
    colorAttrRef.current = colorAttr;
    scaleAttrRef.current = scaleAttr;

    // TSL dynamic buffer nodes — DynamicDrawUsage for efficient per-frame uploads
    const posNode = instancedDynamicBufferAttribute(posAttr, 'vec3');
    const colorNode = instancedDynamicBufferAttribute(colorAttr, 'vec4');
    const scaleNode = instancedDynamicBufferAttribute(scaleAttr, 'float');

    // Geometry
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', posAttr);

    // Single material for ALL explosion particles — 1 draw call
    const material = new SpriteNodeMaterial();
    material.positionNode = posNode;
    material.colorNode = vec4(
      colorNode.xyz.mul(float(EXPLOSION.EMISSIVE_MULT)),
      colorNode.w,
    );
    material.scaleNode = scaleNode;
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = TOTAL_PARTICLES;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshRef.current = mesh;

    devLog.success('Explosion', `Pool ready: ${EXPLOSION.POOL_SIZE} slots × ${EXPLOSION.PARTICLE_COUNT} = ${TOTAL_PARTICLES} particles (1 draw call)`);

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
      particlesRef.current = null;
      slotsRef.current = [];
      gpuPosRef.current = null;
      gpuColorRef.current = null;
      gpuScaleRef.current = null;
      posAttrRef.current = null;
      colorAttrRef.current = null;
      scaleAttrRef.current = null;
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

    const count = EXPLOSION.PARTICLE_COUNT;
    const dirs = _randomDirs!;
    const speeds = _randomSpeeds!;
    const lifeMults = _randomLifeMults!;

    // --- 1. SPAWN ---
    const requests = useExplosionStore.getState().consumeRequests();
    if (requests.length > 0) {
      for (const req of requests) {
        // Find inactive slot, or recycle oldest
        let slotIdx = -1;
        let oldestTime = -1;
        for (let i = 0; i < slots.length; i++) {
          if (!slots[i].active) { slotIdx = i; break; }
          if (slots[i].timeAlive > oldestTime) {
            oldestTime = slots[i].timeAlive;
            slotIdx = i;
          }
        }
        if (slotIdx === -1) slotIdx = 0;

        const slot = slots[slotIdx];
        _tempColor.set(req.color);

        slot.active = true;
        slot.needsCleanup = false;
        slot.timeAlive = 0;
        slot.scale = req.scale;
        slot.colorR = _tempColor.r;
        slot.colorG = _tempColor.g;
        slot.colorB = _tempColor.b;

        // Init particles — CPU scatter
        const base = slotIdx * count;
        const spd = EXPLOSION.SPEED * req.scale;
        for (let i = 0; i < count; i++) {
          const gi = base + i;
          particles.posX[gi] = req.position[0];
          particles.posY[gi] = req.position[1];
          particles.posZ[gi] = req.position[2];
          const s = spd * speeds[i];
          particles.velX[gi] = dirs[i * 3] * s;
          particles.velY[gi] = dirs[i * 3 + 1] * s + 4;
          particles.velZ[gi] = dirs[i * 3 + 2] * s;
          const life = EXPLOSION.LIFE * lifeMults[i];
          particles.life[gi] = life;
          particles.maxLife[gi] = life;
          // Set initial scale so it appears this frame
          gpuScale[gi] = EXPLOSION.SPRITE_SIZE * req.scale;
        }
      }
      devLog.info('Explosion', `Spawned ${requests.length} in 0.0ms`);
    }

    // --- 2. UPDATE (only active/cleanup slots) ---
    const dt = Math.min(delta, 0.05);
    const gravity = EXPLOSION.GRAVITY;
    const dragMult = 1 - dt * 2;

    // Track dirty range for partial GPU upload
    let dirtyMin = TOTAL_PARTICLES;
    let dirtyMax = -1;

    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];

      if (!slot.active) {
        // One-time cleanup: zero out GPU scale when slot dies
        if (slot.needsCleanup) {
          slot.needsCleanup = false;
          const base = si * count;
          for (let i = 0; i < count; i++) {
            gpuScale[base + i] = 0;
          }
          if (base < dirtyMin) dirtyMin = base;
          if (base + count > dirtyMax) dirtyMax = base + count;
        }
        continue;
      }

      slot.timeAlive += dt;
      const base = si * count;

      // Slot death
      if (slot.timeAlive > EXPLOSION.LIFE * 1.5) {
        slot.active = false;
        slot.needsCleanup = true;
        // Zero out immediately
        for (let i = 0; i < count; i++) {
          gpuScale[base + i] = 0;
        }
        if (base < dirtyMin) dirtyMin = base;
        if (base + count > dirtyMax) dirtyMax = base + count;
        continue;
      }

      // Track this slot in dirty range
      if (base < dirtyMin) dirtyMin = base;
      if (base + count > dirtyMax) dirtyMax = base + count;

      const cr = slot.colorR;
      const cg = slot.colorG;
      const cb = slot.colorB;
      const spriteSize = EXPLOSION.SPRITE_SIZE * slot.scale;

      for (let i = 0; i < count; i++) {
        const gi = base + i;
        let life = particles.life[gi] - dt;
        particles.life[gi] = life;

        if (life <= 0) {
          if (gpuScale[gi] !== 0) gpuScale[gi] = 0;
          continue;
        }

        // Velocity: gravity + drag
        particles.velY[gi] -= gravity * dt;
        particles.velX[gi] *= dragMult;
        particles.velY[gi] *= dragMult;
        particles.velZ[gi] *= dragMult;

        // Position
        particles.posX[gi] += particles.velX[gi] * dt;
        particles.posY[gi] += particles.velY[gi] * dt;
        particles.posZ[gi] += particles.velZ[gi] * dt;

        // Write GPU buffers
        gpuPos[gi * 3] = particles.posX[gi];
        gpuPos[gi * 3 + 1] = particles.posY[gi];
        gpuPos[gi * 3 + 2] = particles.posZ[gi];

        const alpha = life / particles.maxLife[gi];
        gpuColor[gi * 4] = cr;
        gpuColor[gi * 4 + 1] = cg;
        gpuColor[gi * 4 + 2] = cb;
        gpuColor[gi * 4 + 3] = alpha;

        gpuScale[gi] = spriteSize * alpha;
      }
    }

    // --- 3. PARTIAL GPU UPLOAD ---
    if (dirtyMax > dirtyMin) {
      const rangeCount = dirtyMax - dirtyMin;

      posAttr.clearUpdateRanges();
      posAttr.addUpdateRange(dirtyMin * 3, rangeCount * 3);
      posAttr.needsUpdate = true;

      colorAttr.clearUpdateRanges();
      colorAttr.addUpdateRange(dirtyMin * 4, rangeCount * 4);
      colorAttr.needsUpdate = true;

      scaleAttr.clearUpdateRanges();
      scaleAttr.addUpdateRange(dirtyMin, rangeCount);
      scaleAttr.needsUpdate = true;
    }

    frameTiming.end('Explosions');
  });

  return null;
}
