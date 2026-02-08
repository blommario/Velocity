/**
 * GPU-efficient projectile rendering with SpriteNodeMaterial.
 *
 * Replaces per-projectile Mesh+PointLight (80+ draw calls) with:
 * - Single instanced sprite mesh for all projectiles + trails
 * - Emissive colors (x6) trigger bloom glow — no PointLights needed
 * - CPU writes positions into Float32Array, GPU renders as sprites
 * - Uses instancedDynamicBufferAttribute for efficient per-frame CPU→GPU transfer
 * - Trail shifting is trivial CPU work (16 slots x 6 points = 96 vec3 copies)
 *
 * Total: 1 draw call for ALL projectiles regardless of count.
 *
 * Engine component — no game store imports.
 */
import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { float, vec4, instancedDynamicBufferAttribute } from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial,
  Mesh as ThreeMesh, Group,
} from 'three/webgpu';
import { BufferGeometry, InstancedBufferAttribute } from 'three';
import { devLog, frameTiming } from '../stores/devLogStore';

const GPU_PROJ = {
  /** Emissive multiplier — must exceed bloom threshold (0.8) for glow */
  EMISSIVE_MULT: 6.0,
  /** Hidden Y for inactive sprites */
  HIDDEN_Y: -9999,
} as const;

interface GpuProjectilesConfig {
  maxSlots: number;
  trailLength: number;
  rocketColor: [number, number, number]; // RGB 0-1
  grenadeColor: [number, number, number]; // RGB 0-1
  spriteSize: number;
  trailSpriteSize: number;
}

const DEFAULT_CONFIG: GpuProjectilesConfig = {
  maxSlots: 16,
  trailLength: 6,
  rocketColor: [1.0, 0.4, 0.05],      // brighter orange-red
  grenadeColor: [0.3, 1.0, 0.1],      // bright green
  spriteSize: 0.6,
  trailSpriteSize: 0.4,
};

/** Slot control interface — CPU writes per frame, zero allocation */
export interface GpuProjectileSlot {
  setActive(active: boolean): void;
  setPosition(x: number, y: number, z: number): void;
  setType(type: number): void; // 0=rocket, 1=grenade
}

// Module-level singleton for the hook
let _globalSlots: GpuProjectileSlot[] = [];
let _globalReady = false;

/** Hook for game bridge to access slots. Returns empty array until ready. */
export function useGpuProjectileSlots(): GpuProjectileSlot[] {
  return _globalSlots;
}

/** Check if GPU projectiles are initialized */
export function isGpuProjectilesReady(): boolean {
  return _globalReady;
}

/**
 * Per-slot CPU-side state. Mutable in place — zero GC.
 */
interface SlotState {
  active: boolean;
  posX: number;
  posY: number;
  posZ: number;
  type: number; // 0=rocket, 1=grenade
}

export function GpuProjectiles(props: Partial<GpuProjectilesConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...props };
  const { maxSlots, trailLength } = config;
  const pointsPerSlot = trailLength + 1; // head + trail points
  const totalPoints = maxSlots * pointsPerSlot;

  const { scene } = useThree();
  const containerRef = useRef<Group | null>(null);
  const slotStatesRef = useRef<SlotState[]>([]);

  // Raw Float32Arrays for GPU attribute data
  const posDataRef = useRef<Float32Array | null>(null);
  const colorDataRef = useRef<Float32Array | null>(null);
  const scaleDataRef = useRef<Float32Array | null>(null);

  // InstancedBufferAttribute refs for .needsUpdate
  const posAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const scaleAttrRef = useRef<InstancedBufferAttribute | null>(null);

  // Create slot control API (stable references, mutates state in-place)
  const createSlotApi = useCallback((state: SlotState): GpuProjectileSlot => ({
    setActive(active: boolean) { state.active = active; },
    setPosition(x: number, y: number, z: number) {
      state.posX = x; state.posY = y; state.posZ = z;
    },
    setType(type: number) { state.type = type; },
  }), []);

  useEffect(() => {
    const container = new Group();
    container.name = 'GpuProjectiles';
    scene.add(container);
    containerRef.current = container;

    // Pre-allocate slot states
    const slotStates: SlotState[] = [];
    for (let i = 0; i < maxSlots; i++) {
      slotStates.push({
        active: false,
        posX: 0, posY: GPU_PROJ.HIDDEN_Y, posZ: 0,
        type: 0,
      });
    }
    slotStatesRef.current = slotStates;

    // Flat CPU arrays: position (vec3), color (vec4 RGBA), scale (float)
    const posData = new Float32Array(totalPoints * 3);
    const colorData = new Float32Array(totalPoints * 4);
    const scaleData = new Float32Array(totalPoints);

    // Initialize all positions to hidden
    for (let i = 0; i < totalPoints; i++) {
      posData[i * 3 + 1] = GPU_PROJ.HIDDEN_Y;
    }

    posDataRef.current = posData;
    colorDataRef.current = colorData;
    scaleDataRef.current = scaleData;

    // Standard InstancedBufferAttributes — DynamicDrawUsage set via TSL node
    const posAttr = new InstancedBufferAttribute(posData, 3);
    const colorAttr = new InstancedBufferAttribute(colorData, 4);
    const scaleAttr = new InstancedBufferAttribute(scaleData, 1);

    posAttrRef.current = posAttr;
    colorAttrRef.current = colorAttr;
    scaleAttrRef.current = scaleAttr;

    // TSL dynamic buffer nodes — DynamicDrawUsage + instancing
    // This tells WebGPU to use staging buffers for efficient per-frame uploads
    const posNode = instancedDynamicBufferAttribute(posAttr, 'vec3');
    const colorNode = instancedDynamicBufferAttribute(colorAttr, 'vec4');
    const scaleNode = instancedDynamicBufferAttribute(scaleAttr, 'float');

    // Geometry — instance count drives rendering
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', posAttr);

    // Material — 1 draw call for all projectile sprites
    const material = new SpriteNodeMaterial();
    material.positionNode = posNode;
    material.colorNode = vec4(
      colorNode.xyz.mul(float(GPU_PROJ.EMISSIVE_MULT)),
      colorNode.w,
    );
    material.scaleNode = scaleNode;
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = totalPoints;
    mesh.frustumCulled = false;
    container.add(mesh);

    // Build slot API
    const slotApis = slotStates.map(createSlotApi);
    _globalSlots = slotApis;
    _globalReady = true;

    devLog.success('Projectile', `GPU sprite pool ready: ${maxSlots} slots x ${pointsPerSlot} trail = ${totalPoints} sprites (1 draw call)`);

    return () => {
      scene.remove(container);
      geometry.dispose();
      material.dispose();
      containerRef.current = null;
      _globalSlots = [];
      _globalReady = false;
      slotStatesRef.current = [];
      posDataRef.current = null;
      colorDataRef.current = null;
      scaleDataRef.current = null;
      posAttrRef.current = null;
      colorAttrRef.current = null;
      scaleAttrRef.current = null;
      devLog.info('Projectile', 'GPU pool disposed');
    };
  }, [scene, maxSlots, trailLength, totalPoints, pointsPerSlot, createSlotApi, config.rocketColor, config.grenadeColor, config.spriteSize, config.trailSpriteSize]);

  // Per-frame: shift trails, write head positions, mark buffers dirty
  useFrame(() => {
    const posData = posDataRef.current;
    const colorData = colorDataRef.current;
    const scaleData = scaleDataRef.current;
    const posAttr = posAttrRef.current;
    const colorAttr = colorAttrRef.current;
    const scaleAttr = scaleAttrRef.current;
    const slotStates = slotStatesRef.current;

    if (!posData || !colorData || !scaleData || !posAttr || !colorAttr || !scaleAttr) return;

    frameTiming.begin('Projectiles');

    for (let s = 0; s < maxSlots; s++) {
      const state = slotStates[s];
      const baseIdx = s * pointsPerSlot;

      if (!state.active) {
        // Hide all points in this slot
        for (let p = 0; p < pointsPerSlot; p++) {
          const idx = baseIdx + p;
          scaleData[idx] = 0;
          colorData[idx * 4 + 3] = 0;
        }
        continue;
      }

      // Shift trail: copy backwards (oldest <- newer)
      // Point 0 = head (current), point N = oldest trail
      for (let p = pointsPerSlot - 1; p > 0; p--) {
        const dst = (baseIdx + p) * 3;
        const src = (baseIdx + p - 1) * 3;
        posData[dst] = posData[src];
        posData[dst + 1] = posData[src + 1];
        posData[dst + 2] = posData[src + 2];
      }

      // Write head position
      const headOff = baseIdx * 3;
      posData[headOff] = state.posX;
      posData[headOff + 1] = state.posY;
      posData[headOff + 2] = state.posZ;

      // Color + alpha based on type and trail position
      const isRocket = state.type === 0;
      const r = isRocket ? config.rocketColor[0] : config.grenadeColor[0];
      const g = isRocket ? config.rocketColor[1] : config.grenadeColor[1];
      const b = isRocket ? config.rocketColor[2] : config.grenadeColor[2];

      for (let p = 0; p < pointsPerSlot; p++) {
        const idx = baseIdx + p;
        const fadeT = p / Math.max(pointsPerSlot - 1, 1);
        const alpha = 1.0 - fadeT * 0.8; // head=1.0, tail=0.2

        colorData[idx * 4] = r;
        colorData[idx * 4 + 1] = g;
        colorData[idx * 4 + 2] = b;
        colorData[idx * 4 + 3] = alpha;

        // Scale: head full size, trail shrinks
        const size = p === 0 ? config.spriteSize : config.trailSpriteSize * (1 - fadeT * 0.5);
        scaleData[idx] = size * alpha;
      }
    }

    // Mark GPU buffers dirty — DynamicDrawUsage ensures efficient staging transfer
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;

    frameTiming.end('Projectiles');
  });

  return null;
}
