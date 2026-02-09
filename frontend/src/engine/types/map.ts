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
