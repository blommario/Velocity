export { ExplosionManager, useExplosionStore } from './ExplosionEffect';
export { GpuParticles } from './GpuParticles';
export { GpuProjectiles, useGpuProjectileSlots, isGpuProjectilesReady, type GpuProjectileSlot } from './GpuProjectiles';
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
