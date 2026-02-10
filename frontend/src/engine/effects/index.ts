export { ExplosionManager, useExplosionStore } from './ExplosionEffect';
export { GpuParticles } from './GpuParticles';
export { GpuProjectiles, useGpuProjectileSlots, isGpuProjectilesReady, type GpuProjectileSlot, type GpuProjectilesConfig } from './GpuProjectiles';
export { GpuLightSprites, type LightSpriteData } from './GpuLightSprites';
export { ScreenShake, type ScreenShakeProps } from './ScreenShake';
export { PhysicsDice, type PhysicsDiceProps, type DieRollRequest, type DieResult } from './PhysicsDice';
export { getDieGeometry, disposeDieGeometries, DIE_TYPES, type DieType, type DieGeometryData } from './diceGeometry';
export {
  FogOfWarGrid, FOG_DEFAULTS, VisibilityState,
  type FogOfWarConfig, type VisibilityValue,
} from './FogOfWar';
export {
  useFogOfWar,
  type UseFogOfWarProps, type FogOfWarResult, type FogOfWarUniforms,
} from './useFogOfWar';
export { buildHeightmap, fogConfigToHeightmapConfig, type HeightmapConfig } from './FogOfWarHeightmap';
export {
  createFogComputeResources,
  type FogComputeResources, type FogComputeUniforms, type FogGridConfig,
} from './fogOfWarCompute';
export {
  useAnimation,
  type UseAnimationProps, type UseAnimationResult,
  type AnimationLoopMode, type PlayOptions,
} from './useAnimation';
export { AnimatedModel, type AnimatedModelProps } from './AnimatedModel';
export { MuzzleFlash, triggerMuzzleFlash } from './MuzzleFlash';
export { DecalPool, spawnDecal } from './DecalPool';
export { EnvironmentalParticles } from './EnvironmentalParticles';
export { PARTICLE_PRESETS, type ParticlePreset, type ParticlePresetName } from './particlePresets';
export {
  ProceduralSkybox, SKY_PRESETS,
  type SkyPreset, type ProceduralSkyPresetName,
} from './ProceduralSkybox';
export { HdriSkybox } from './HdriSkybox';
export { AtmosphericFog } from './AtmosphericFog';
export { WaterSurface } from './WaterSurface';
export { FogVolume } from './FogVolume';
export { ParticleEmitter } from './ParticleEmitter';
export { LineRenderEffect, type LineRenderConfig, type LineRenderEffectProps } from './LineRenderEffect';
export { ObjectHighlight, type ObjectHighlightConfig, type ObjectHighlightProps } from './ObjectHighlight';
export { SpeedTrail, type SpeedTrailConfig, type SpeedTrailProps } from './SpeedTrail';
export { spawnImpactEffects, type ImpactIntensity } from './spawnImpactEffects';
