/**
 * GPU Color Picking — select 3D objects by rendering unique color IDs
 * to a 1×1 pixel render target and reading back asynchronously.
 *
 * Supports up to 16,777,215 pickable objects (24-bit RGB encoding, 0 = miss).
 *
 * Uses Three.js layers to avoid full scene traversal:
 *  - Pickable objects are assigned to PICK_LAYER (layer 7)
 *  - The camera enables only PICK_LAYER during the pick render
 *  - Non-pickable objects are never touched
 *
 * InstancedMesh support:
 *  - Uses a TSL MeshBasicNodeMaterial with per-instance color via
 *    `colorNode = idToColor(baseId + instanceIndex)` — each instance
 *    gets a unique color computed on the GPU in a single draw call.
 *
 * Engine-level: no game store imports.
 */

import {
  RenderTarget,
  Scene,
  Camera,
  Object3D,
  Mesh,
  Material,
  MeshBasicMaterial,
  InstancedMesh,
  UnsignedByteType,
  NearestFilter,
  LinearSRGBColorSpace,
  Color,
  Vector4,
  Layers,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { vec4, float, uint, uniform, instanceIndex, bitAnd, shiftRight } from 'three/tsl';
import type { WebGPURenderer } from 'three/webgpu';

/** Max pickable objects: 2^24 - 1 (ID 0 = background / miss) */
const MAX_PICKABLE_ID = 0xFFFFFF;

/** Layer index dedicated to pickable objects. */
export const PICK_LAYER = 7;

/** Reusable Vector4 for viewport save/restore. */
const _savedViewport = new Vector4();

/** Reusable Layers for camera layer manipulation. */
const _pickOnlyLayers = new Layers();
_pickOnlyLayers.set(PICK_LAYER);

/** Encode a numeric ID (1..16777215) into an RGB Color (CPU-side). */
function idToColor(id: number, target: Color): Color {
  const r = (id & 0xFF) / 255;
  const g = ((id >> 8) & 0xFF) / 255;
  const b = ((id >> 16) & 0xFF) / 255;
  return target.setRGB(r, g, b, LinearSRGBColorSpace);
}

/** Decode an RGB pixel (Uint8) back to a numeric ID. */
function pixelToId(r: number, g: number, b: number): number {
  return r + (g << 8) + (b << 16);
}

/** Black background for pick renders — reused. */
const _blackBg = new Color(0, 0, 0);

export interface PickableEntry {
  id: number;
  object: Object3D;
  /** For instanced meshes: which instance index this ID maps to. */
  instanceIndex?: number;
}

export interface PickResult {
  id: number;
  entry: PickableEntry;
}

/**
 * Cached instanced pick material + its baseId uniform.
 * One per InstancedMesh — the baseId uniform is updated before each pick render.
 */
interface InstancedPickMaterial {
  material: MeshBasicNodeMaterial;
  baseIdUniform: { value: number };
}

export class GpuPicker {
  private nextId = 1;
  private readonly entries = new Map<number, PickableEntry>();
  private readonly objectToIds = new Map<Object3D, number[]>();
  private readonly pickTarget: RenderTarget;
  /** Flat-color materials for non-instanced meshes (keyed by pick ID). */
  private readonly idMaterials = new Map<number, MeshBasicMaterial>();
  /** TSL materials for instanced meshes (keyed by InstancedMesh). */
  private readonly instancedMaterials = new Map<InstancedMesh, InstancedPickMaterial>();
  /** Registered pickable meshes — iterated during pick instead of scene.traverse. */
  private readonly pickableMeshes = new Set<Mesh>();
  private _pendingRead: Promise<PickResult | null> | null = null;

  constructor() {
    this.pickTarget = new RenderTarget(1, 1, {
      type: UnsignedByteType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      count: 1,
    });
  }

  /** Register a single Object3D (Mesh) as pickable. Returns its unique ID. */
  register(object: Object3D): number {
    const id = this.allocateId();
    const entry: PickableEntry = { id, object };
    this.entries.set(id, entry);
    this.trackObject(object, id);
    object.layers.enable(PICK_LAYER);
    if (object instanceof Mesh) this.pickableMeshes.add(object);
    return id;
  }

  /**
   * Register a specific instance of an InstancedMesh.
   * Call once per instance index you want to be individually pickable.
   * IDs are allocated contiguously — baseId + instanceIndex gives per-instance ID.
   */
  registerInstance(mesh: InstancedMesh, instIdx: number): number {
    const id = this.allocateId();
    const entry: PickableEntry = { id, object: mesh, instanceIndex: instIdx };
    this.entries.set(id, entry);
    this.trackObject(mesh, id);
    mesh.layers.enable(PICK_LAYER);
    this.pickableMeshes.add(mesh);
    return id;
  }

  /** Unregister all IDs associated with an object. */
  unregister(object: Object3D): void {
    const ids = this.objectToIds.get(object);
    if (!ids) return;
    this.removeIds(ids);
    this.objectToIds.delete(object);
    object.layers.disable(PICK_LAYER);
    if (object instanceof Mesh) this.pickableMeshes.delete(object);
    if (object instanceof InstancedMesh) {
      const cached = this.instancedMaterials.get(object);
      if (cached) {
        cached.material.dispose();
        this.instancedMaterials.delete(object);
      }
    }
  }

  /** Unregister specific IDs (safe for shared InstancedMesh). */
  unregisterIds(ids: number[]): void {
    if (ids.length === 0) return;

    const firstEntry = this.entries.get(ids[0]);
    const object = firstEntry?.object;

    this.removeIds(ids);

    if (object) {
      const remaining = this.objectToIds.get(object);
      if (remaining) {
        const idSet = new Set(ids);
        const filtered = remaining.filter(id => !idSet.has(id));
        if (filtered.length === 0) {
          this.objectToIds.delete(object);
          object.layers.disable(PICK_LAYER);
          if (object instanceof Mesh) this.pickableMeshes.delete(object);
          if (object instanceof InstancedMesh) {
            const cached = this.instancedMaterials.get(object);
            if (cached) {
              cached.material.dispose();
              this.instancedMaterials.delete(object);
            }
          }
        } else {
          this.objectToIds.set(object, filtered);
        }
      }
    }
  }

  /** Look up the entry for a given ID. */
  getEntry(id: number): PickableEntry | undefined {
    return this.entries.get(id);
  }

  /** Number of registered pickable IDs. */
  get count(): number {
    return this.entries.size;
  }

  /**
   * Perform a GPU pick at the given screen coordinates.
   *
   * Renders pickable meshes (via layers) with ID-colored materials to a
   * 1×1 render target, reads back the pixel asynchronously, and returns
   * the picked entry (or null for background/miss).
   *
   * Non-blocking: uses readRenderTargetPixelsAsync.
   */
  async pick(
    screenX: number,
    screenY: number,
    camera: Camera,
    renderer: WebGPURenderer,
    scene: Scene,
  ): Promise<PickResult | null> {
    if (this._pendingRead) return this._pendingRead;

    this._pendingRead = this._doPick(screenX, screenY, camera, renderer, scene);
    try {
      return await this._pendingRead;
    } finally {
      this._pendingRead = null;
    }
  }

  /** Dispose all GPU resources. */
  dispose(): void {
    for (const object of this.objectToIds.keys()) {
      object.layers.disable(PICK_LAYER);
    }
    this.pickTarget.dispose();
    for (const mat of this.idMaterials.values()) {
      mat.dispose();
    }
    for (const cached of this.instancedMaterials.values()) {
      cached.material.dispose();
    }
    this.idMaterials.clear();
    this.instancedMaterials.clear();
    this.entries.clear();
    this.objectToIds.clear();
    this.pickableMeshes.clear();
    this.nextId = 1;
  }

  // ─── internals ───────────────────────────────────────────────────────

  private allocateId(): number {
    if (this.nextId > MAX_PICKABLE_ID) {
      throw new Error(`GpuPicker: exceeded max pickable objects (${MAX_PICKABLE_ID})`);
    }
    return this.nextId++;
  }

  private trackObject(object: Object3D, id: number): void {
    let ids = this.objectToIds.get(object);
    if (!ids) {
      ids = [];
      this.objectToIds.set(object, ids);
    }
    ids.push(id);
  }

  private removeIds(ids: number[]): void {
    for (const id of ids) {
      this.entries.delete(id);
      const mat = this.idMaterials.get(id);
      if (mat) {
        mat.dispose();
        this.idMaterials.delete(id);
      }
    }
  }

  /** Flat-color material for non-instanced meshes. */
  private getIdMaterial(id: number): MeshBasicMaterial {
    let mat = this.idMaterials.get(id);
    if (!mat) {
      mat = new MeshBasicMaterial();
      idToColor(id, mat.color);
      mat.fog = false;
      mat.toneMapped = false;
      this.idMaterials.set(id, mat);
    }
    return mat;
  }

  /**
   * TSL material for InstancedMesh — computes per-instance color on the GPU.
   * `colorNode = idToColor(baseId + instanceIndex)` where baseId is a uniform
   * updated before each pick render to the first registered ID for that mesh.
   */
  private getInstancedPickMaterial(mesh: InstancedMesh): InstancedPickMaterial {
    let cached = this.instancedMaterials.get(mesh);
    if (!cached) {
      const baseIdUniform = { value: 0 };
      const uBaseId = uniform(baseIdUniform, 'uint');
      const id = uBaseId.add(uint(instanceIndex));

      // GPU-side ID → RGB color encoding (24-bit uint, matching CPU pixelToId decode)
      const r = float(bitAnd(id, 0xFF)).div(255);
      const g = float(bitAnd(shiftRight(id, 8), 0xFF)).div(255);
      const b = float(bitAnd(shiftRight(id, 16), 0xFF)).div(255);

      const mat = new MeshBasicNodeMaterial();
      mat.colorNode = vec4(r, g, b, 1);
      mat.fog = false;
      mat.toneMapped = false;

      cached = { material: mat, baseIdUniform };
      this.instancedMaterials.set(mesh, cached);
    }
    return cached;
  }

  private async _doPick(
    screenX: number,
    screenY: number,
    camera: Camera,
    renderer: WebGPURenderer,
    scene: Scene,
  ): Promise<PickResult | null> {
    const canvas = renderer.domElement;
    const pixelRatio = renderer.getPixelRatio();
    const width = canvas.width;
    const height = canvas.height;

    // Convert screen coords to pixel coords (DPR-aware)
    const px = Math.round(screenX * pixelRatio);
    // Flip Y: screen Y is top-down, framebuffer Y is bottom-up
    const py = Math.round(height - screenY * pixelRatio);

    if (px < 0 || px >= width || py < 0 || py >= height) return null;

    // Swap materials on pickable meshes only (O(pickable) not O(scene))
    const overrides = new Map<Mesh, Material | Material[]>();
    for (const mesh of this.pickableMeshes) {
      if (!mesh.visible) continue;
      const ids = this.objectToIds.get(mesh);
      if (!ids || ids.length === 0) continue;

      overrides.set(mesh, mesh.material);

      if (mesh instanceof InstancedMesh) {
        // TSL material: baseId + instanceIndex gives each instance a unique color
        const cached = this.getInstancedPickMaterial(mesh);
        cached.baseIdUniform.value = ids[0];
        mesh.material = cached.material;
      } else {
        // Flat color for non-instanced meshes
        mesh.material = this.getIdMaterial(ids[0]);
      }
    }

    // Save scene & camera state, then configure for pick render
    renderer.getViewport(_savedViewport);
    const savedCameraLayers = camera.layers.mask;
    const savedBackground = scene.background;
    const savedFog = scene.fog;
    const savedFogNode = scene.fogNode;

    try {
      // Camera sees only PICK_LAYER
      camera.layers.mask = _pickOnlyLayers.mask;

      // Scissor to 1×1 pixel at pick point
      renderer.setViewport(px, py, 1, 1);
      renderer.setScissor(px, py, 1, 1);
      renderer.setScissorTest(true);

      // Disable fog & set black background for clean ID reads
      scene.background = _blackBg;
      scene.fog = null;
      scene.fogNode = null;

      renderer.setRenderTarget(this.pickTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    } finally {
      // Restore everything — even if render throws
      camera.layers.mask = savedCameraLayers;
      renderer.setViewport(_savedViewport);
      renderer.setScissorTest(false);
      scene.background = savedBackground;
      scene.fog = savedFog;
      scene.fogNode = savedFogNode;

      for (const [mesh, originalMat] of overrides) {
        mesh.material = originalMat;
      }
    }

    // Async pixel readback (non-blocking GPU→CPU)
    const pixels = await renderer.readRenderTargetPixelsAsync(
      this.pickTarget, 0, 0, 1, 1,
    );

    const id = pixelToId(pixels[0], pixels[1], pixels[2]);
    if (id === 0) return null;

    const entry = this.entries.get(id);
    if (!entry) return null;

    return { id, entry };
  }
}
