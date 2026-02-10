/**
 * Map lighting setup hook — collects light sprites, builds clustered lighting
 * data, and configures shadow light from map settings.
 *
 * Depends on: useClusteredLighting, useTileClusteredLighting, useShadowLight, settingsStore
 * Used by: MapLoader
 */
import { useMemo } from 'react';
import {
  useClusteredLighting, useTileClusteredLighting, useShadowLight, type LightData,
} from '@engine/rendering';
import type { LightSpriteData } from '@engine/effects/GpuLightSprites';
import { useSettingsStore } from '@game/stores/settingsStore';
import type { MapData, Vec3 } from './types';

const DEFAULT_LIGHTING = {
  ambientIntensity: 0.4,
  directionalIntensity: 1.2,
  directionalPosition: [50, 80, 30] as Vec3,
  hemisphereGround: '#3a3a3a',
  hemisphereSky: '#87ceeb',
  hemisphereIntensity: 0.3,
  fogColor: '#1a1a2e',
  fogNear: 80,
  fogFar: 200,
};

export function useMapLighting(data: MapData) {
  const lighting = { ...DEFAULT_LIGHTING, ...data.lighting };

  // Collect all light sprite positions into a single array for GpuLightSprites (1 draw call)
  const lightSprites = useMemo(() => {
    const sprites: LightSpriteData[] = [];
    for (const bp of data.boostPads ?? []) {
      sprites.push({
        position: [bp.position[0], bp.position[1] + 1, bp.position[2]],
        color: bp.color ?? '#00ff88',
        size: 3.0,
      });
    }
    for (const sg of data.speedGates ?? []) {
      sprites.push({
        position: sg.position,
        color: sg.color ?? '#00ccff',
        size: 2.0,
      });
    }
    for (const gp of data.grapplePoints ?? []) {
      sprites.push({
        position: [gp.position[0], gp.position[1] + 1, gp.position[2]],
        color: '#a78bfa',
        size: 3.0,
      });
    }
    return sprites;
  }, [data.boostPads, data.speedGates, data.grapplePoints]);

  // Convert sprite data → LightData for clustered PBR lighting
  const clusterLightData = useMemo((): LightData[] => {
    return lightSprites.map((s) => ({
      position: s.position,
      color: s.color,
      intensity: 2.0,
      distance: 30,
      decay: 2,
    }));
  }, [lightSprites]);

  // Steg 1: PointLight pool (used when < 64 lights)
  const { lightsNode } = useClusteredLighting({ lights: clusterLightData });

  // Steg 2: Tile-clustered GPU compute (used when >= 64 lights)
  const { tileLightingNode, isTileClustered } = useTileClusteredLighting({ lights: clusterLightData });

  // Shadow light — quality driven by settings store
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  useShadowLight({
    quality: shadowQuality,
    position: lighting.directionalPosition,
    intensity: lighting.directionalIntensity,
    color: lighting.directionalColor,
  });

  const hasLights = clusterLightData.length > 0;

  return { lighting, lightSprites, lightsNode, tileLightingNode, isTileClustered, hasLights };
}
