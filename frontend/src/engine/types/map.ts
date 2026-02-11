/**
 * Map data schema — blocks, zones, environment, lighting, and terrain types.
 *
 * Depends on: three (Group, AnimationClip)
 * Used by: editorStore, map loader, rendering layer, physics
 */

import type { Group, AnimationClip } from 'three';

// ── Asset types ──

/** A loaded model with its associated animation clips. */
export interface ModelAsset {
  scene: Group;
  animations: AnimationClip[];
}

// ── Primitives ──
export type Vec3 = [number, number, number];
export type Color = string; // hex color e.g. "#ff0000"

// ── Material types ──
export type ProceduralMaterialType = 'concrete' | 'metal' | 'scifi-panel' | 'neon' | 'rust' | 'tile';
export type EmissiveAnimation = 'none' | 'pulse' | 'flicker' | 'breathe';
export type BlendMode = 'height' | 'noise';

// ── Block types ──
export type BlockShape = 'box' | 'ramp' | 'cylinder' | 'wedge';

export interface MapBlock {
  shape: BlockShape;
  position: Vec3;
  size: Vec3;            // [width, height, depth]
  rotation?: Vec3;       // euler angles in radians, default [0,0,0]
  color: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  textureSet?: string;
  textureScale?: [number, number];  // UV repeat [x, y], default [1,1]
  roughness?: number;               // PBR roughness override (0-1)
  metalness?: number;               // PBR metalness override (0-1)
  proceduralMaterial?: ProceduralMaterialType;
  emissiveAnimation?: EmissiveAnimation;
  emissiveAnimationSpeed?: number;
  blendTextureSet?: string;
  blendProceduralMaterial?: ProceduralMaterialType;
  blendMode?: BlendMode;
  blendHeight?: number;
  blendSharpness?: number;
}

// ── Model props (glTF placed in map) ──
export interface MapModel {
  modelUrl: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  collider?: 'trimesh' | 'hull' | 'none';
}

// ── Generic zone types ──
export interface CheckpointData {
  position: Vec3;
  size: Vec3;
  index: number;
}

export interface FinishZoneData {
  position: Vec3;
  size: Vec3;
}

export interface KillZoneData {
  position: Vec3;
  size: Vec3;
}

export interface BoostPadData {
  position: Vec3;
  direction: Vec3;
  speed?: number;
  size?: Vec3;
  color?: Color;
}

export interface LaunchPadData {
  position: Vec3;
  direction: Vec3;
  speed?: number;
  size?: Vec3;
  color?: Color;
}

export interface SpeedGateData {
  position: Vec3;
  size?: Vec3;
  multiplier?: number;
  minSpeed?: number;
  color?: Color;
}

export interface GrapplePointData {
  position: Vec3;
}

export interface SurfRampData {
  position: Vec3;
  size: Vec3;
  rotation: Vec3;
  color?: Color;
}

export interface MovingPlatformData {
  size: Vec3;
  waypoints: Vec3[];
  speed: number;
  color?: Color;
  pauseTime?: number;
}

// ── Environment effects ──

export type WaterSurfaceType = 'water' | 'lava';

export interface WaterSurfaceData {
  position: Vec3;
  size: [number, number];  // [width, depth] — plane is horizontal
  type: WaterSurfaceType;
  color?: Color;
  flowDirection?: [number, number];  // [x, z] normalized flow
  flowSpeed?: number;               // default 1.0
  waveHeight?: number;              // vertex displacement amplitude, default 0.3
  waveScale?: number;               // wave frequency, default 2.0
  opacity?: number;                 // default 0.7 for water, 0.9 for lava
}

export type FogVolumeShape = 'box' | 'sphere';

export interface FogVolumeData {
  position: Vec3;
  shape: FogVolumeShape;
  size: Vec3;           // box half-extents or [radius, radius, radius] for sphere
  color?: Color;
  density?: number;     // 0-1, default 0.5
  heightFalloff?: number; // density fades toward top, default 0.0 (uniform)
}

// ── Heightmap terrain ──
export interface HeightmapTerrainData {
  position: Vec3;
  size: [number, number];         // [widthX, depthZ] in world units
  heights: number[][];            // 2D array [row][col], row=Z, col=X, values = Y height
  color?: Color;
  colorHigh?: Color;              // gradient color at peak heights
  roughness?: number;             // PBR roughness (default 0.85)
  metalness?: number;             // PBR metalness (default 0.05)
}

export type ParticleEmitterPreset = 'smoke' | 'sparks' | 'ash' | 'dust' | 'trail' | 'snow' | 'pollen';

export interface ParticleEmitterData {
  position: Vec3;
  preset: ParticleEmitterPreset;
  /** Override particle count (defaults to preset value) */
  count?: number;
  /** Override spread radius (defaults to preset value) */
  spread?: number;
  /** Wind applied to particles [x, y, z] */
  wind?: Vec3;
  /** Color override (hex) */
  color?: Color;
}

// ── Pickup / Settings / MapData (generic engine versions) ──

export interface AmmoPickupData {
  position: Vec3;
  weaponType: string;
  amount: number;
  respawnTime?: number;
}

export interface MapSettings {
  gravityOverride?: number;
  maxRocketAmmo?: number;
  maxGrenadeAmmo?: number;
  timeLimit?: number;
  parTime?: number;
}

export interface MapData {
  spawnPoint: Vec3;
  spawnDirection: Vec3;
  blocks: MapBlock[];
  checkpoints: CheckpointData[];
  finish: FinishZoneData;
  boostPads?: BoostPadData[];
  launchPads?: LaunchPadData[];
  speedGates?: SpeedGateData[];
  grapplePoints?: GrapplePointData[];
  ammoPickups?: AmmoPickupData[];
  surfRamps?: SurfRampData[];
  movingPlatforms?: MovingPlatformData[];
  killZones?: KillZoneData[];
  models?: MapModel[];
  settings?: MapSettings;
  skybox?: SkyboxType;
  lighting?: AmbientLighting;
  backgroundColor?: Color;
  waterSurfaces?: WaterSurfaceData[];
  fogVolumes?: FogVolumeData[];
  particleEmitters?: ParticleEmitterData[];
  heightmapTerrains?: HeightmapTerrainData[];
}

// ── Lighting & Environment ──
export type ProceduralSkyboxType = 'day' | 'sunset' | 'night' | 'neon' | 'sky';
export type SkyboxType = ProceduralSkyboxType | `hdri:${string}`;

export interface AmbientLighting {
  ambientIntensity: number;
  ambientColor?: Color;
  directionalIntensity: number;
  directionalColor?: Color;
  directionalPosition?: Vec3;
  hemisphereGround?: Color;
  hemisphereSky?: Color;
  hemisphereIntensity?: number;
  fogColor?: Color;
  fogNear?: number;
  fogFar?: number;
}
