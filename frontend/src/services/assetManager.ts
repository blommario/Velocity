import {
  TextureLoader,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  RepeatWrapping,
  EquirectangularReflectionMapping,
} from 'three/webgpu';
import type {
  Group,
  Texture,
  DataTexture,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ── Types ──

export interface LoadProgress {
  loaded: number;
  total: number;
  url: string;
}

export interface TextureSet {
  albedo: Texture;
  normal?: Texture;
  roughness?: Texture;
  metalness?: Texture;
  emissive?: Texture;
  ao?: Texture;
}

// ── Constants ──

const ASSET_BASE = '/assets';
const MODEL_PATH = `${ASSET_BASE}/models`;
const TEXTURE_PATH = `${ASSET_BASE}/textures`;
const HDRI_PATH = `${ASSET_BASE}/hdri`;

// ── Caches ──

const modelCache = new Map<string, Group>();
const textureCache = new Map<string, Texture>();
const hdriCache = new Map<string, DataTexture>();
const textureSetCache = new Map<string, TextureSet>();
const loadingModels = new Map<string, Promise<Group>>();
const loadingTextures = new Map<string, Promise<Texture>>();
const loadingHdri = new Map<string, Promise<DataTexture>>();

// ── Loaders (lazy init) ──

let gltfLoader: GLTFLoader | null = null;
let fbxLoader: FBXLoader | null = null;
let textureLoader: TextureLoader | null = null;
let rgbeLoader: RGBELoader | null = null;
let dracoLoader: DRACOLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    gltfLoader.setDRACOLoader(dracoLoader);
  }
  return gltfLoader;
}

function getFBXLoader(): FBXLoader {
  if (!fbxLoader) {
    fbxLoader = new FBXLoader();
  }
  return fbxLoader;
}

function getTextureLoader(): TextureLoader {
  if (!textureLoader) {
    textureLoader = new TextureLoader();
  }
  return textureLoader;
}

function getRGBELoader(): RGBELoader {
  if (!rgbeLoader) {
    rgbeLoader = new RGBELoader();
  }
  return rgbeLoader;
}

// ── Model Loading ──

export function loadModel(
  name: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<Group> {
  const cached = modelCache.get(name);
  if (cached) return Promise.resolve(cached.clone());

  const existing = loadingModels.get(name);
  if (existing) return existing.then((g) => g.clone());

  const url = `${MODEL_PATH}/${name}`;
  const isFBX = name.toLowerCase().endsWith('.fbx');

  const progressHandler = (event: ProgressEvent) => {
    onProgress?.({ loaded: event.loaded, total: event.total, url });
  };

  const promise = isFBX
    ? new Promise<Group>((resolve, reject) => {
        getFBXLoader().load(
          url,
          (group) => {
            // FBX models often have large scale — normalize
            modelCache.set(name, group);
            loadingModels.delete(name);
            resolve(group.clone());
          },
          progressHandler,
          (error) => {
            loadingModels.delete(name);
            reject(new Error(`Failed to load FBX model ${name}: ${error}`));
          },
        );
      })
    : new Promise<Group>((resolve, reject) => {
        getGLTFLoader().load(
          url,
          (gltf) => {
            modelCache.set(name, gltf.scene);
            loadingModels.delete(name);
            resolve(gltf.scene.clone());
          },
          progressHandler,
          (error) => {
            loadingModels.delete(name);
            reject(new Error(`Failed to load glTF model ${name}: ${error}`));
          },
        );
      });

  loadingModels.set(name, promise);
  return promise;
}

// ── Texture Loading ──

export function loadTexture(
  name: string,
  colorSpace: 'srgb' | 'linear' = 'srgb',
): Promise<Texture> {
  const cacheKey = `${name}:${colorSpace}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const existing = loadingTextures.get(cacheKey);
  if (existing) return existing;

  const url = `${TEXTURE_PATH}/${name}`;
  const promise = new Promise<Texture>((resolve, reject) => {
    getTextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = colorSpace === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        textureCache.set(cacheKey, texture);
        loadingTextures.delete(cacheKey);
        resolve(texture);
      },
      undefined,
      (error) => {
        loadingTextures.delete(cacheKey);
        reject(new Error(`Failed to load texture ${name}: ${error}`));
      },
    );
  });

  loadingTextures.set(cacheKey, promise);
  return promise;
}

// ── Texture Set Loading ──

export async function loadTextureSet(prefix: string): Promise<TextureSet> {
  const cached = textureSetCache.get(prefix);
  if (cached) return cached;

  // Load albedo (required), rest are optional
  const albedo = await loadTexture(`${prefix}_albedo.jpg`, 'srgb');

  const optionalLoad = async (
    suffix: string,
    cs: 'srgb' | 'linear',
  ): Promise<Texture | undefined> => {
    try {
      return await loadTexture(`${prefix}_${suffix}`, cs);
    } catch {
      return undefined;
    }
  };

  const [normal, roughness, metalness, emissive, ao] = await Promise.all([
    optionalLoad('normal.jpg', 'linear'),
    optionalLoad('roughness.jpg', 'linear'),
    optionalLoad('metalness.jpg', 'linear'),
    optionalLoad('emissive.jpg', 'srgb'),
    optionalLoad('ao.jpg', 'linear'),
  ]);

  const set: TextureSet = { albedo, normal, roughness, metalness, emissive, ao };
  textureSetCache.set(prefix, set);
  return set;
}

// ── HDRI Loading ──

export function loadHDRI(
  name: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<DataTexture> {
  const cached = hdriCache.get(name);
  if (cached) return Promise.resolve(cached);

  const existing = loadingHdri.get(name);
  if (existing) return existing;

  const url = `${HDRI_PATH}/${name}`;
  const promise = new Promise<DataTexture>((resolve, reject) => {
    getRGBELoader().load(
      url,
      (texture) => {
        texture.mapping = EquirectangularReflectionMapping;
        hdriCache.set(name, texture);
        loadingHdri.delete(name);
        resolve(texture);
      },
      (event) => {
        onProgress?.({
          loaded: event.loaded,
          total: event.total,
          url,
        });
      },
      (error) => {
        loadingHdri.delete(name);
        reject(new Error(`Failed to load HDRI ${name}: ${error}`));
      },
    );
  });

  loadingHdri.set(name, promise);
  return promise;
}

// ── Preloading ──

export async function preloadAssets(assets: {
  models?: string[];
  textureSets?: string[];
  hdri?: string[];
}): Promise<void> {
  const promises: Promise<unknown>[] = [];

  if (assets.models) {
    for (const m of assets.models) {
      promises.push(loadModel(m));
    }
  }
  if (assets.textureSets) {
    for (const t of assets.textureSets) {
      promises.push(loadTextureSet(t));
    }
  }
  if (assets.hdri) {
    for (const h of assets.hdri) {
      promises.push(loadHDRI(h));
    }
  }

  await Promise.all(promises);
}

// ── Cache Management ──

export function clearAssetCache(): void {
  // Dispose textures
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();

  // Dispose HDRIs
  for (const tex of hdriCache.values()) {
    tex.dispose();
  }
  hdriCache.clear();

  // Clear model cache (meshes disposed by Three.js scene)
  modelCache.clear();
  textureSetCache.clear();
}

export function getAssetStats(): { models: number; textures: number; hdri: number } {
  return {
    models: modelCache.size,
    textures: textureCache.size,
    hdri: hdriCache.size,
  };
}
