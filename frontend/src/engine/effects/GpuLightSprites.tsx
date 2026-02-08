/**
 * GPU-efficient light sprites using instanced SpriteNodeMaterial.
 *
 * Replaces per-light PointLight (N draw calls + shadow passes) with a single
 * instanced sprite mesh. Emissive color × 6.0 triggers bloom glow.
 *
 * Pulse animation runs entirely on the GPU via TSL nodes — no per-frame
 * CPU buffer updates needed. A single uniform(time) drives all pulses,
 * with per-instance phase offsets baked into a static buffer.
 *
 * Total: 1 draw call for ALL light sprites regardless of count.
 *
 * Engine component — no game store imports.
 */
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  float, vec4, sin, uniform,
  instancedDynamicBufferAttribute,
} from 'three/tsl';
import {
  AdditiveBlending, SpriteNodeMaterial,
  Mesh as ThreeMesh, Group,
} from 'three/webgpu';
import { BufferGeometry, InstancedBufferAttribute } from 'three';
import { devLog } from '../stores/devLogStore';

const GPU_LIGHT = {
  EMISSIVE_MULT: 6.0,
  PULSE_SPEED: 2.5,
  PULSE_MIN: 0.6,
  PULSE_MAX: 1.0,
} as const;

export interface LightSpriteData {
  position: [number, number, number];
  color: string;
  size?: number;
  pulse?: boolean;
}

interface GpuLightSpritesProps {
  lights: LightSpriteData[];
}

/** Parse "#rrggbb" hex to [r,g,b] in 0–1 range */
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  return [
    ((num >> 16) & 0xff) / 255,
    ((num >> 8) & 0xff) / 255,
    (num & 0xff) / 255,
  ];
}

export function GpuLightSprites({ lights }: GpuLightSpritesProps) {
  const { scene } = useThree();
  const containerRef = useRef<Group | null>(null);
  const timeUniformRef = useRef<{ value: number } | null>(null);

  useEffect(() => {
    const count = lights.length;
    if (count === 0) return;

    const container = new Group();
    container.name = 'GpuLightSprites';
    scene.add(container);
    containerRef.current = container;

    // ── Static CPU arrays (written once, never updated per-frame) ──
    const posData = new Float32Array(count * 3);
    const colorData = new Float32Array(count * 4); // rgb + pulseFlag (1.0=pulse, 0.0=static)
    const scaleData = new Float32Array(count);
    const phaseData = new Float32Array(count); // random phase offset per light

    for (let i = 0; i < count; i++) {
      const light = lights[i];
      const rgb = hexToRgb(light.color);
      const size = light.size ?? 2.0;
      const pulse = light.pulse ?? true;

      posData[i * 3] = light.position[0];
      posData[i * 3 + 1] = light.position[1];
      posData[i * 3 + 2] = light.position[2];

      colorData[i * 4] = rgb[0];
      colorData[i * 4 + 1] = rgb[1];
      colorData[i * 4 + 2] = rgb[2];
      colorData[i * 4 + 3] = pulse ? 1.0 : 0.0; // alpha = pulse flag

      scaleData[i] = size;
      phaseData[i] = Math.random() * Math.PI * 2;
    }

    // ── Buffer attributes ──
    const posAttr = new InstancedBufferAttribute(posData, 3);
    const colorAttr = new InstancedBufferAttribute(colorData, 4);
    const scaleAttr = new InstancedBufferAttribute(scaleData, 1);
    const phaseAttr = new InstancedBufferAttribute(phaseData, 1);

    // ── TSL nodes ──
    const posNode = instancedDynamicBufferAttribute(posAttr, 'vec3');
    const colorNode = instancedDynamicBufferAttribute(colorAttr, 'vec4');
    const scaleNode = instancedDynamicBufferAttribute(scaleAttr, 'float');
    const phaseNode = instancedDynamicBufferAttribute(phaseAttr, 'float');

    // Time uniform — single value updated once per frame
    const timeU = uniform(0);
    timeUniformRef.current = timeU;

    // ── GPU pulse computation ──
    // sin(time * speed + phase) → [−1,1] → [0,1] → [PULSE_MIN, PULSE_MAX]
    // pulseFlag (colorNode.w): 1.0 = animated, 0.0 = static (factor stays 1.0)
    const pulseFlag = colorNode.w;
    const sineWave = sin(timeU.mul(float(GPU_LIGHT.PULSE_SPEED)).add(phaseNode));
    const normalized = sineWave.add(float(1.0)).mul(float(0.5)); // [0,1]
    const pulseFactor = float(GPU_LIGHT.PULSE_MIN).add(
      normalized.mul(float(GPU_LIGHT.PULSE_MAX - GPU_LIGHT.PULSE_MIN)),
    );
    // Mix: static lights get factor=1.0, pulsing lights get pulseFactor
    const factor = pulseFlag.mul(pulseFactor).add(
      float(1.0).sub(pulseFlag),
    );

    // ── Geometry ──
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', posAttr);

    // ── Material — emissive × 6.0 for bloom, pulse computed on GPU ──
    const material = new SpriteNodeMaterial();
    material.positionNode = posNode;
    material.colorNode = vec4(
      colorNode.xyz.mul(float(GPU_LIGHT.EMISSIVE_MULT)).mul(factor),
      float(1.0),
    );
    material.scaleNode = scaleNode.mul(
      float(0.9).add(factor.mul(float(0.1))),
    );
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;

    const mesh = new ThreeMesh(geometry, material);
    mesh.count = count;
    mesh.frustumCulled = false;
    container.add(mesh);

    devLog.success('Lighting', `GPU light sprites ready: ${count} lights (1 draw call, GPU pulse)`);

    return () => {
      scene.remove(container);
      geometry.dispose();
      material.dispose();
      containerRef.current = null;
      timeUniformRef.current = null;
      devLog.info('Lighting', 'GPU light sprites disposed');
    };
  }, [scene, lights]);

  // Single uniform update per frame — no buffer writes, no needsUpdate
  useFrame((_, delta) => {
    if (timeUniformRef.current) {
      timeUniformRef.current.value += delta;
    }
  });

  return null;
}
