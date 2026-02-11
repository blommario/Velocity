/**
 * Types barrel — re-exports input, movement, and map data types.
 *
 * Depends on: physics, map
 * Used by: engine and game modules
 */

export type { InputState, MovementState } from './physics';
export type {
  ModelAsset,
  Vec3, Color, BlockShape, MapBlock, MapModel,
  CheckpointData, FinishZoneData, KillZoneData,
  BoostPadData, LaunchPadData, SpeedGateData,
  GrapplePointData, SurfRampData, MovingPlatformData,
  ProceduralSkyboxType, SkyboxType, AmbientLighting,
  ProceduralMaterialType, EmissiveAnimation, BlendMode,
  WaterSurfaceData, WaterSurfaceType,
  FogVolumeData, FogVolumeShape,
  ParticleEmitterData, ParticleEmitterPreset,
} from './map';
