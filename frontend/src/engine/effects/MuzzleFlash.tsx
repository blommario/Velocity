/**
 * Muzzle Flash — GPU sprite burst effect for weapon firing.
 *
 * Uses instancedDynamicBufferAttribute + SpriteNodeMaterial for a 2-3 frame
 * flash burst with emissive glow (x8.0 exceeds bloom threshold). Additive
 * blending, no depth write. Single draw call.
 *
 * Returns a <primitive> so the container is inserted into the R3F scene graph
 * of whatever parent renders this component (e.g. ViewmodelLayer portal scene).
 *
 * Engine component — no game store imports. Controlled via trigger function.
 */
import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { float, vec4, instancedDynamicBufferAttribute } from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial,
  Mesh as ThreeMesh, Group,
} from 'three/webgpu';
import { BufferGeometry, InstancedBufferAttribute } from 'three';
import { devLog } from '../stores/devLogStore';

const MUZZLE = {
  SPRITE_COUNT: 6,
  EMISSIVE_MULT: 8.0,
  DURATION: 0.06,
  SPREAD: 0.08,
  SIZE: 0.12,
  HIDDEN_Y: -9999,
} as const;

interface FlashState {
  active: boolean;
  needsClear: boolean;
  timer: number;
  originX: number;
  originY: number;
  originZ: number;
  offsetsX: Float32Array;
  offsetsY: Float32Array;
  offsetsZ: Float32Array;
}

// Module-level trigger function
let _triggerFlash: ((x: number, y: number, z: number, r: number, g: number, b: number) => void) | null = null;

/**
 * Trigger a muzzle flash at the given position with the given color.
 * Coordinates are in the local space of whatever scene the MuzzleFlash
 * component is mounted in (e.g. viewmodel-local when inside ViewmodelLayer).
 * No-op if MuzzleFlash component is not mounted.
 */
export function triggerMuzzleFlash(
  x: number, y: number, z: number,
  r = 1.0, g = 0.7, b = 0.2,
): void {
  _triggerFlash?.(x, y, z, r, g, b);
}

export function MuzzleFlash() {
  const containerRef = useRef<Group | null>(null);
  const flashRef = useRef<FlashState>({
    active: false,
    needsClear: false,
    timer: 0,
    originX: 0, originY: 0, originZ: 0,
    offsetsX: new Float32Array(MUZZLE.SPRITE_COUNT),
    offsetsY: new Float32Array(MUZZLE.SPRITE_COUNT),
    offsetsZ: new Float32Array(MUZZLE.SPRITE_COUNT),
  });

  // GPU buffer refs
  const posDataRef = useRef<Float32Array | null>(null);
  const colorDataRef = useRef<Float32Array | null>(null);
  const scaleDataRef = useRef<Float32Array | null>(null);
  const posAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<InstancedBufferAttribute | null>(null);
  const scaleAttrRef = useRef<InstancedBufferAttribute | null>(null);

  // Color ref for per-flash color
  const flashColorRef = useRef<[number, number, number]>([1.0, 0.7, 0.2]);

  const randomizeOffsets = useCallback((flash: FlashState) => {
    for (let i = 0; i < MUZZLE.SPRITE_COUNT; i++) {
      flash.offsetsX[i] = (Math.random() - 0.5) * MUZZLE.SPREAD * 2;
      flash.offsetsY[i] = (Math.random() - 0.5) * MUZZLE.SPREAD * 2;
      flash.offsetsZ[i] = (Math.random() - 0.5) * MUZZLE.SPREAD * 2;
    }
  }, []);

  // Create the container Group once (stable across renders)
  const container = useMemo(() => {
    const g = new Group();
    g.name = 'MuzzleFlash';
    return g;
  }, []);
  containerRef.current = container;

  // Build GPU resources imperatively, attach mesh to the container
  useEffect(() => {
    const count = MUZZLE.SPRITE_COUNT;
    const posData = new Float32Array(count * 3);
    const colorData = new Float32Array(count * 4);
    const scaleData = new Float32Array(count);

    // Initialize hidden
    for (let i = 0; i < count; i++) {
      posData[i * 3 + 1] = MUZZLE.HIDDEN_Y;
    }

    posDataRef.current = posData;
    colorDataRef.current = colorData;
    scaleDataRef.current = scaleData;

    const posAttr = new InstancedBufferAttribute(posData, 3);
    const colorAttr = new InstancedBufferAttribute(colorData, 4);
    const scaleAttr = new InstancedBufferAttribute(scaleData, 1);

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
    material.colorNode = vec4(
      colorNode.xyz.mul(float(MUZZLE.EMISSIVE_MULT)),
      colorNode.w,
    );
    material.scaleNode = scaleNode;
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = count;
    mesh.frustumCulled = false;
    container.add(mesh);

    // Register trigger function
    _triggerFlash = (x, y, z, r, g, b) => {
      const flash = flashRef.current;
      flash.active = true;
      flash.timer = MUZZLE.DURATION;
      flash.originX = x;
      flash.originY = y;
      flash.originZ = z;
      flashColorRef.current = [r, g, b];
      randomizeOffsets(flash);
    };

    devLog.success('MuzzleFlash', `GPU sprite pool ready: ${count} sprites (1 draw call)`);

    return () => {
      container.remove(mesh);
      geometry.dispose();
      material.dispose();
      posDataRef.current = null;
      colorDataRef.current = null;
      scaleDataRef.current = null;
      posAttrRef.current = null;
      colorAttrRef.current = null;
      scaleAttrRef.current = null;
      _triggerFlash = null;
    };
  }, [container, randomizeOffsets]);

  useFrame((_, delta) => {
    const posData = posDataRef.current;
    const colorData = colorDataRef.current;
    const scaleData = scaleDataRef.current;
    const posAttr = posAttrRef.current;
    const colorAttr = colorAttrRef.current;
    const scaleAttr = scaleAttrRef.current;
    const flash = flashRef.current;

    if (!posData || !colorData || !scaleData || !posAttr || !colorAttr || !scaleAttr) return;

    if (!flash.active) {
      // Only upload the "clear" frame once, then skip entirely while idle
      if (flash.needsClear) {
        for (let i = 0; i < MUZZLE.SPRITE_COUNT; i++) {
          scaleData[i] = 0;
          colorData[i * 4 + 3] = 0;
        }
        scaleAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        flash.needsClear = false;
      }
      return;
    }

    flash.timer -= delta;
    if (flash.timer <= 0) {
      flash.active = false;
      flash.needsClear = true; // schedule one final clear upload
      return;
    }

    // Progress: 1.0 at start -> 0.0 at end (time-normalized, frame-rate independent)
    const progress = flash.timer / MUZZLE.DURATION;
    const [r, g, b] = flashColorRef.current;

    for (let i = 0; i < MUZZLE.SPRITE_COUNT; i++) {
      // Position: origin + random spread that expands over time
      const expand = 1 + (1 - progress) * 2;
      posData[i * 3] = flash.originX + flash.offsetsX[i] * expand;
      posData[i * 3 + 1] = flash.originY + flash.offsetsY[i] * expand;
      posData[i * 3 + 2] = flash.originZ + flash.offsetsZ[i] * expand;

      // Color with alpha fade
      colorData[i * 4] = r;
      colorData[i * 4 + 1] = g;
      colorData[i * 4 + 2] = b;
      colorData[i * 4 + 3] = progress;

      // Scale: shrinks as flash fades (per-sprite jitter from pre-allocated offsets)
      const jitter = 0.5 + (flash.offsetsX[i] + 0.5 * MUZZLE.SPREAD) / MUZZLE.SPREAD * 0.5;
      scaleData[i] = MUZZLE.SIZE * progress * jitter;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
  });

  // Return the container as a <primitive> so R3F inserts it into the
  // correct scene graph (e.g. the ViewmodelLayer's portal scene)
  return <primitive object={container} />;
}
