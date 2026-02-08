/**
 * useClusteredLighting.ts — React hook that manages a pre-allocated pool
 * of PointLights and a LightsNode for selective per-material lighting.
 *
 * Updates at ~4Hz: sorts lights by distance to camera, assigns N nearest
 * to the pool, and exposes a LightsNode for material binding.
 *
 * Engine-level: no game store imports.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  PointLight, Color, LightsNode,
} from 'three/webgpu';
import {
  selectNearestLights,
  CLUSTERED_DEFAULTS,
  type LightData,
  type ClusteredLightsConfig,
} from './ClusteredLights';
import { devLog } from '../stores/devLogStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseClusteredLightingProps {
  /** All dynamic lights in the scene. */
  lights: readonly LightData[];
  /** Optional config overrides. */
  config?: Partial<ClusteredLightsConfig>;
}

export interface ClusteredLightingResult {
  /** Assign to material.lightsNode for selective PBR lighting. */
  lightsNode: LightsNode;
}

// ---------------------------------------------------------------------------
// Pre-allocated
// ---------------------------------------------------------------------------

const _color = new Color();

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClusteredLighting({
  lights: lightData,
  config,
}: UseClusteredLightingProps): ClusteredLightingResult {
  const { scene } = useThree();
  const maxActive = config?.maxActiveLights ?? CLUSTERED_DEFAULTS.maxActiveLights;
  const updateInterval = config?.updateInterval ?? CLUSTERED_DEFAULTS.updateInterval;

  // Pre-allocate PointLight pool (once)
  const pool = useMemo(() => {
    const arr: PointLight[] = [];
    for (let i = 0; i < maxActive; i++) {
      const light = new PointLight(0xffffff, 0, 50, 2);
      light.castShadow = false;
      light.position.set(0, -10000, 0); // offscreen
      arr.push(light);
    }
    devLog.info('Lighting', `Clustered lights pool: ${maxActive} PointLights`);
    return arr;
  }, [maxActive]);

  // Add pool lights to scene on mount, remove on unmount
  useEffect(() => {
    for (const light of pool) {
      scene.add(light);
    }
    devLog.success('Lighting', `Clustered lights active: ${pool.length} pool lights in scene`);
    return () => {
      for (const light of pool) {
        scene.remove(light);
        light.dispose();
      }
      devLog.info('Lighting', 'Clustered lights disposed');
    };
  }, [scene, pool]);

  // Create LightsNode (once per pool). Three.js updates automatically
  // when PointLight properties change.
  const lightsNode = useMemo(() => {
    return new LightsNode().setLights(pool);
  }, [pool]);

  // Timer for throttled updates
  const timerRef = useRef(0);
  const lightDataRef = useRef(lightData);
  lightDataRef.current = lightData;

  // Per-frame: update pool at ~4Hz
  useFrame(({ camera }, delta) => {
    timerRef.current += delta;
    if (timerRef.current < updateInterval) return;
    // Subtract interval instead of resetting to prevent time drift.
    // Clamp to avoid spiral-of-death after tab backgrounding.
    timerRef.current = timerRef.current > updateInterval * 2 ? 0 : timerRef.current - updateInterval;

    const data = lightDataRef.current;
    if (data.length === 0) {
      // Park all lights offscreen
      for (const light of pool) {
        light.intensity = 0;
        light.position.y = -10000;
      }
      return;
    }

    // Select N nearest lights
    const nearest = selectNearestLights(data, camera.position.x, camera.position.y, camera.position.z, maxActive);

    // Update pool PointLights
    for (let i = 0; i < pool.length; i++) {
      const light = pool[i];
      if (i < nearest.length) {
        const ld = data[nearest[i]];
        light.position.set(ld.position[0], ld.position[1], ld.position[2]);
        _color.set(ld.color);
        light.color.copy(_color);
        light.intensity = ld.intensity;
        light.distance = ld.distance;
        light.decay = ld.decay;
      } else {
        // Park unused lights offscreen
        light.intensity = 0;
        light.position.y = -10000;
      }
    }
  });

  return { lightsNode };
}
