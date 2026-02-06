import type { WeaponType } from '../physics/types';

// ── Primitives ──
export type Vec3 = [number, number, number];
export type Color = string; // hex color e.g. "#ff0000"

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
}

// ── Game objects ──
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
  direction: Vec3;       // normalized
  speed?: number;
  size?: Vec3;
  color?: Color;
}

export interface LaunchPadData {
  position: Vec3;
  direction: Vec3;       // normalized direction + angle
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

export interface AmmoPickupData {
  position: Vec3;
  weaponType: WeaponType;
  amount: number;
  respawnTime?: number;
}

export interface GrapplePointData {
  position: Vec3;
}

export interface SurfRampData {
  position: Vec3;
  size: Vec3;
  rotation: Vec3;        // must result in 30-60 degree surface
  color?: Color;
}

export interface MovingPlatformData {
  size: Vec3;
  waypoints: Vec3[];     // positions to move between
  speed: number;         // units per second
  color?: Color;
  pauseTime?: number;    // seconds to pause at each waypoint
}

// ── Lighting & Environment ──
export type SkyboxType = 'day' | 'sunset' | 'night' | 'neon' | 'sky';

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

// ── Map Settings ──
export interface MapSettings {
  gravityOverride?: number;     // override default 800
  maxRocketAmmo?: number;       // default 5
  maxGrenadeAmmo?: number;      // default 3
  timeLimit?: number;           // seconds, 0 = no limit
  parTime?: number;             // par time in seconds
}

// ── Top-level MapData ──
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
  settings?: MapSettings;
  skybox?: SkyboxType;
  lighting?: AmbientLighting;
  backgroundColor?: Color;
}
