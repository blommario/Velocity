/**
 * DecalPool — Pooled impact decal system using instanced rendering.
 *
 * Uses a pre-allocated pool of instanced quads oriented to surface normals.
 * InstancedMesh with per-frame matrix + alpha updates via instancedDynamicBufferAttribute.
 * Ring-buffer recycling: oldest decal replaced when pool exhausted.
 * Auto-fade: alpha ramps from 1→0 over lifetime, then slot recycled.
 *
 * Engine component — no game store imports. Controlled via module-level trigger.
 *
 * Total: 1 draw call for ALL decals regardless of count.
 */
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { float, vec4, instancedDynamicBufferAttribute } from 'three/tsl';
import {
  MeshBasicNodeMaterial,
  InstancedMesh as ThreeInstancedMesh,
} from 'three/webgpu';
import {
  PlaneGeometry, Object3D, Vector3, Quaternion,
  InstancedBufferAttribute, DoubleSide,
} from 'three';
import { useSettingsStore } from '../stores/settingsStore';
import { devLog } from '../stores/devLogStore';

const DECAL = {
  /** Maximum simultaneous decals */
  POOL_SIZE: 64,
  /** Default decal quad size (world units) */
  DEFAULT_SIZE: 1.2,
  /** Default lifetime in seconds */
  DEFAULT_LIFETIME: 8.0,
  /** Seconds before end when fade-out begins */
  FADE_DURATION: 2.0,
  /** Small offset along normal to prevent z-fighting */
  NORMAL_OFFSET: 0.02,
  /** Hidden position */
  HIDDEN_Y: -9999,
} as const;

interface DecalSlot {
  active: boolean;
  /** Remaining lifetime */
  life: number;
  /** Total lifetime for fade calculation */
  totalLife: number;
  /** Color RGB 0-1 */
  r: number;
  g: number;
  b: number;
}

// Module-level trigger — wired to component via ref
let _spawnDecal: ((
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  size?: number, r?: number, g?: number, b?: number,
  lifetime?: number,
) => void) | null = null;

/**
 * Spawn a decal at the given position oriented to the surface normal.
 * No-op if DecalPool component is not mounted or particles disabled.
 */
export function spawnDecal(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  size: number = DECAL.DEFAULT_SIZE,
  r: number = 0.15, g: number = 0.15, b: number = 0.15,
  lifetime: number = DECAL.DEFAULT_LIFETIME,
): void {
  _spawnDecal?.(x, y, z, nx, ny, nz, size, r, g, b, lifetime);
}

// Pre-allocated math objects — zero GC
const _normal = new Vector3();
const _quat = new Quaternion();
const _dummy = new Object3D();
const _lookTarget = new Vector3();

export function DecalPool() {
  const { scene } = useThree();
  const meshRef = useRef<ThreeInstancedMesh | null>(null);
  const slotsRef = useRef<DecalSlot[]>([]);
  const nextIndexRef = useRef(0);

  // GPU buffer refs
  const colorDataRef = useRef<Float32Array | null>(null);
  const colorAttrRef = useRef<InstancedBufferAttribute | null>(null);

  useEffect(() => {
    const particles = useSettingsStore.getState().particles;
    if (!particles) return;

    const count = DECAL.POOL_SIZE;

    // Pre-allocate slots
    const slots: DecalSlot[] = [];
    for (let i = 0; i < count; i++) {
      slots.push({
        active: false,
        life: 0,
        totalLife: DECAL.DEFAULT_LIFETIME,
        r: 0.15, g: 0.15, b: 0.15,
      });
    }
    slotsRef.current = slots;
    nextIndexRef.current = 0;

    // Per-instance color+alpha (vec4)
    const colorData = new Float32Array(count * 4);
    colorDataRef.current = colorData;

    const colorAttr = new InstancedBufferAttribute(colorData, 4);
    colorAttrRef.current = colorAttr;

    const colorNode = instancedDynamicBufferAttribute(colorAttr, 'vec4');

    // Plane geometry — 1x1, will be scaled per-instance via matrix
    const geometry = new PlaneGeometry(1, 1);

    const material = new MeshBasicNodeMaterial();
    material.colorNode = vec4(
      colorNode.xyz,
      colorNode.w.mul(float(0.7)), // slightly transparent even at full life
    );
    material.transparent = true;
    material.depthWrite = false;
    material.side = DoubleSide;

    const mesh = new ThreeInstancedMesh(geometry, material, count);
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.name = 'DecalPool';

    // Initialize all instances hidden
    for (let i = 0; i < count; i++) {
      _dummy.position.set(0, DECAL.HIDDEN_Y, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      // Zero alpha
      colorData[i * 4 + 3] = 0;
    }
    mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;

    scene.add(mesh);
    meshRef.current = mesh;

    // Register spawn trigger
    _spawnDecal = (x, y, z, nx, ny, nz, size, r, g, b, lifetime) => {
      const idx = nextIndexRef.current;
      nextIndexRef.current = (idx + 1) % count;

      const slot = slots[idx];
      slot.active = true;
      slot.life = lifetime ?? DECAL.DEFAULT_LIFETIME;
      slot.totalLife = slot.life;
      slot.r = r ?? 0.15;
      slot.g = g ?? 0.15;
      slot.b = b ?? 0.15;

      const s = size ?? DECAL.DEFAULT_SIZE;

      // Orient quad to face along surface normal
      _normal.set(nx, ny, nz).normalize();

      // Position: impact point + small offset along normal
      _dummy.position.set(
        x + _normal.x * DECAL.NORMAL_OFFSET,
        y + _normal.y * DECAL.NORMAL_OFFSET,
        z + _normal.z * DECAL.NORMAL_OFFSET,
      );

      // Rotate quad to align with normal: look at point along normal
      _lookTarget.copy(_dummy.position).add(_normal);
      _dummy.lookAt(_lookTarget);

      // Add slight random roll to avoid uniform look
      const roll = Math.random() * Math.PI * 2;
      _quat.setFromAxisAngle(_normal, roll);
      _dummy.quaternion.premultiply(_quat);

      _dummy.scale.set(s, s, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(idx, _dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;

      // Set color at full alpha
      colorData[idx * 4] = slot.r;
      colorData[idx * 4 + 1] = slot.g;
      colorData[idx * 4 + 2] = slot.b;
      colorData[idx * 4 + 3] = 1.0;
      colorAttr.needsUpdate = true;
    };

    devLog.success('Decals', `Pool ready: ${count} slots (1 draw call)`);

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
      slotsRef.current = [];
      colorDataRef.current = null;
      colorAttrRef.current = null;
      _spawnDecal = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    const slots = slotsRef.current;
    const colorData = colorDataRef.current;
    const colorAttr = colorAttrRef.current;
    const mesh = meshRef.current;

    if (!colorData || !colorAttr || !mesh || slots.length === 0) return;

    // Check particles setting (cheap — no selector, just getState)
    if (!useSettingsStore.getState().particles) return;

    let dirty = false;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.active) continue;

      slot.life -= delta;

      if (slot.life <= 0) {
        // Expired — hide
        slot.active = false;
        colorData[i * 4 + 3] = 0;

        _dummy.position.set(0, DECAL.HIDDEN_Y, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);

        dirty = true;
        continue;
      }

      // Fade-out in last FADE_DURATION seconds
      if (slot.life < DECAL.FADE_DURATION) {
        const alpha = slot.life / DECAL.FADE_DURATION;
        colorData[i * 4 + 3] = alpha;
        dirty = true;
      }
    }

    if (dirty) {
      colorAttr.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return null;
}
