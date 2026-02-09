import type { WeaponType } from '../physics/types';

import type {
  Vec3, Color, BlockShape, MapBlock, MapModel,
  CheckpointData, FinishZoneData, KillZoneData,
  BoostPadData, LaunchPadData, SpeedGateData,
  GrapplePointData, SurfRampData, MovingPlatformData,
  ProceduralSkyboxType, SkyboxType, AmbientLighting,
  ProceduralMaterialType, EmissiveAnimation, BlendMode,
  WaterSurfaceData, WaterSurfaceType,
  FogVolumeData, FogVolumeShape,
  ParticleEmitterData, ParticleEmitterPreset,
} from '../../../engine/types/map';
import type { FogOfWarConfig } from '../../../engine/effects/FogOfWar';

// Re-export all engine map types for backward compatibility
export type {
  Vec3, Color, BlockShape, MapBlock, MapModel,
  CheckpointData, FinishZoneData, KillZoneData,
  BoostPadData, LaunchPadData, SpeedGateData,
  GrapplePointData, SurfRampData, MovingPlatformData,
  ProceduralSkyboxType, SkyboxType, AmbientLighting,
  ProceduralMaterialType, EmissiveAnimation, BlendMode,
  WaterSurfaceData, WaterSurfaceType,
  FogVolumeData, FogVolumeShape,
  ParticleEmitterData, ParticleEmitterPreset,
};

// ── Game-specific types ──

export interface AmmoPickupData {
  position: Vec3;
  weaponType: WeaponType;
  amount: number;
  respawnTime?: number;
}

export interface MapSettings {
  gravityOverride?: number;     // override default 800
  maxRocketAmmo?: number;       // default 5
  maxGrenadeAmmo?: number;      // default 3
  timeLimit?: number;           // seconds, 0 = no limit
  parTime?: number;             // par time in seconds
}

// ── Top-level MapData (Velocity-specific) ──
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
  /** Optional fog-of-war configuration. Omit to disable. */
  fogOfWar?: Partial<FogOfWarConfig>;
  /** Water/lava surfaces */
  waterSurfaces?: WaterSurfaceData[];
  /** Volumetric fog volumes */
  fogVolumes?: FogVolumeData[];
  /** Particle emitters (smoke, fire, ash, etc.) */
  particleEmitters?: ParticleEmitterData[];
}
