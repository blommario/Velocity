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
  HeightmapTerrainData,
  MapSettings as EngineMapSettings,
  MapData as EngineMapData,
  AmmoPickupData as EngineAmmoPickupData,
} from '@engine/types/map';
import type { FogOfWarConfig } from '@engine/effects/FogOfWar';

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
  HeightmapTerrainData,
};

export type { EngineMapSettings as MapSettings };

// ── Game-specific types (narrow weaponType to WeaponType) ──

export interface AmmoPickupData extends Omit<EngineAmmoPickupData, 'weaponType'> {
  weaponType: WeaponType;
}

// ── Top-level MapData (Velocity-specific, extends engine with fog-of-war) ──
export interface MapData extends EngineMapData {
  ammoPickups?: AmmoPickupData[];
  /** Optional fog-of-war configuration. Omit to disable. */
  fogOfWar?: Partial<FogOfWarConfig>;
}
