import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { DirectionalLight } from 'three';
import { CSMShadowNode } from 'three/examples/jsm/csm/CSMShadowNode.js';
import { devLog } from '../stores/devLogStore';
import { SHADOW_PRESETS, type ShadowQuality } from './shadowConfig';

export interface ShadowLightConfig {
  /** Shadow quality level. Controls map size, cascades, bias. */
  quality: ShadowQuality;
  /** World-space direction the light shines FROM (position of the sun). */
  position: [number, number, number];
  /** Light intensity (default 1.2). */
  intensity?: number;
  /** Light color (default white). */
  color?: string;
}

interface ShadowLightRefs {
  light: DirectionalLight;
  csm: CSMShadowNode | null;
  quality: ShadowQuality;
}

/**
 * Engine-level hook: creates a persistent DirectionalLight with CSM shadows.
 * Manages shadow map quality reactively — disposes and recreates CSM on quality change.
 *
 * Returns the DirectionalLight so callers can add it to the scene via JSX primitive.
 */
export function useShadowLight(config: ShadowLightConfig) {
  const { scene, camera } = useThree();
  const refs = useRef<ShadowLightRefs | null>(null);

  const { quality, position, intensity = 1.2, color = '#ffffff' } = config;
  const preset = SHADOW_PRESETS[quality];

  // Create light once, update CSM when quality changes
  useEffect(() => {
    const light = new DirectionalLight(color, intensity);
    light.position.set(position[0], position[1], position[2]);

    let csm: CSMShadowNode | null = null;

    if (preset.enabled) {
      // Configure standard shadow map as base (CSM will override)
      light.castShadow = true;
      light.shadow.mapSize.set(preset.mapSize, preset.mapSize);
      light.shadow.camera.far = preset.maxFar;
      light.shadow.bias = preset.bias;
      light.shadow.normalBias = preset.normalBias;

      // Orthographic bounds for shadow camera
      const extent = preset.maxFar * 0.4;
      light.shadow.camera.left = -extent;
      light.shadow.camera.right = extent;
      light.shadow.camera.top = extent;
      light.shadow.camera.bottom = -extent;

      // CSM for cascade shadow mapping
      // NOTE: Do NOT set csm.camera here. CSMShadowNode._init() is triggered by
      // setup() when this.camera === null. Setting camera early prevents _init()
      // from running, leaving mainFrustum as null → crash in updateFrustums().
      // The camera is assigned in useFrame after _init() has been called by the renderer.
      try {
        csm = new CSMShadowNode(light, {
          cascades: preset.cascades,
          maxFar: preset.maxFar,
          mode: 'practical',
        });
        csm.fade = true;

        devLog.success('Shadows', `CSM created — ${preset.cascades} cascades, ${preset.mapSize}px, maxFar=${preset.maxFar}`);
      } catch (err) {
        devLog.warn('Shadows', `CSM unavailable, using standard shadow map: ${err}`);
        csm = null;
      }
    }

    scene.add(light);
    scene.add(light.target);

    refs.current = { light, csm, quality };

    devLog.info('Shadows', `Shadow quality: ${quality} (${preset.enabled ? `${preset.mapSize}px` : 'disabled'})`);

    return () => {
      scene.remove(light);
      scene.remove(light.target);
      if (light.shadow.map) {
        light.shadow.map.dispose();
      }
      light.dispose();
      refs.current = null;
    };
  }, [quality, scene, camera, preset, position, intensity, color]);

  // Update CSM frustums every frame (lightweight — just matrix updates).
  // Guard: mainFrustum is null until the renderer calls CSM.setup() → _init().
  useFrame(() => {
    const r = refs.current;
    if (!r?.csm || !r.csm.mainFrustum) return;
    r.csm.camera = camera;
    r.csm.updateFrustums();
  });

  return {
    preset,
  };
}
