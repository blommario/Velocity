export { disposeSceneGraph } from './dispose';
export { snapToGrid, snapPosition, snapRotation } from './snapToGrid';
export { SpatialGrid, type SpatialGridConfig, type CellKey, type CellCoord } from './SpatialGrid';
export { useSpatialCulling, type SpatialCullingConfig } from './useSpatialCulling';
export {
  LOD_THRESHOLDS, LOD_GEOMETRY, getLodLevel, distanceSqXZ, splitByLod,
  type LodLevel,
} from './LodManager';
export { GpuPicker, PICK_LAYER, type PickableEntry, type PickResult } from './GpuPicker';
export {
  useGpuPicking, usePickable, usePickableInstances,
  type OnPickCallback, type UseGpuPickingConfig,
} from './usePickable';
export {
  selectNearestLights, CLUSTERED_DEFAULTS,
  type LightData, type ClusteredLightsConfig,
} from './ClusteredLights';
export {
  useClusteredLighting,
  type UseClusteredLightingProps, type ClusteredLightingResult,
} from './useClusteredLighting';
export { applyClusteredLighting, removeClusteredLighting, applyTileLighting, removeTileLighting } from './lightMaterial';
export {
  TILE_CONFIG, buildLightBuffer, tileGridSize,
  type TileLightBuffer,
} from './TileClusteredLights';
export {
  createTileBinningResources,
  type TileBinningResources, type TileBinningUniforms,
} from './tileBinning';
export {
  createTileLightingNode,
  createTileDebugNode,
  type TileLightingNode,
  type TileDebugNode,
} from './tileLightingNode';
export {
  useTileClusteredLighting,
  type UseTileClusteredLightingProps, type TileClusteredLightingResult,
} from './useTileClusteredLighting';
export {
  SHADOW_QUALITY_LEVELS, SHADOW_PRESETS, shadowQualityFromPreset,
  type ShadowQuality, type ShadowPreset,
} from './shadowConfig';
export { useShadowLight, type ShadowLightConfig } from './useShadowLight';
export {
  ViewmodelLayer, getViewmodelScene,
  type ViewmodelLayerProps, type ViewmodelSceneRef,
} from './ViewmodelLayer';
export {
  useViewmodelAnimation,
  type ViewmodelAnimationInput, type ViewmodelAnimationOutput,
} from './useViewmodelAnimation';
export { createHeightmapGeometry } from './heightmapGeometry';
export { valueNoise2D, valueNoise3D, fbm2D } from './tslNoise';
export {
  createProceduralMaterial, getPresetNodes, buildEmissiveAnimationNode, disposeProceduralMaterials,
  type ProceduralMaterialConfig, type ProceduralMaterialResult, type PbrPresetNodes,
} from './proceduralMaterials';
export {
  createBlendFactorNode, blendPbrNodes,
  type TextureBlendConfig, type PbrNodes,
} from './textureBlendNode';
