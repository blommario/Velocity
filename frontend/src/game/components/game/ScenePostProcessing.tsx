/**
 * ScenePostProcessing — wraps PostProcessingEffects with fog-of-war camera
 * tracking and settings-driven effect toggles.
 *
 * Depends on: PostProcessingEffects, useFogOfWar, settingsStore, combatStore
 * Used by: GameCanvas
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PostProcessingEffects } from '@engine/core/PostProcessingEffects';
import { useFogOfWar } from '@engine/effects/useFogOfWar';
import { useSettingsStore } from '@game/stores/settingsStore';
import { useCombatStore } from '@game/stores/combatStore';
import type { FogOfWarConfig } from '@engine/effects/FogOfWar';
import type { MapBlock } from '@engine/types/map';

interface ScenePostProcessingProps {
  fogConfig?: Partial<FogOfWarConfig>;
  blocks?: ReadonlyArray<MapBlock>;
}

export function ScenePostProcessing({ fogConfig, blocks }: ScenePostProcessingProps) {
  const { camera } = useThree();
  const camPosRef = useRef<[number, number, number]>([0, 0, 0]);

  useFrame(() => {
    camPosRef.current[0] = camera.position.x;
    camPosRef.current[1] = camera.position.y;
    camPosRef.current[2] = camera.position.z;
  });

  const enabled = fogConfig !== undefined;
  const { fogTexture, fogComputeResources, fogUniforms } = useFogOfWar({
    enabled,
    config: fogConfig,
    viewPosition: camPosRef.current,
    blocks,
  });

  const ssao = useSettingsStore((s) => s.ssao);
  const colorGrading = useSettingsStore((s) => s.colorGrading);
  const filmGrain = useSettingsStore((s) => s.filmGrain);
  const chromaticAberration = useSettingsStore((s) => s.chromaticAberration);
  const motionBlur = useSettingsStore((s) => s.motionBlur);
  const depthOfField = useSettingsStore((s) => s.depthOfField);
  const isInspecting = useCombatStore((s) => s.isInspecting);

  return (
    <PostProcessingEffects
      fogTexture={fogTexture}
      fogComputeResources={fogComputeResources}
      fogUniforms={fogUniforms}
      ssaoEnabled={ssao}
      colorGradingEnabled={colorGrading}
      filmGrainEnabled={filmGrain}
      chromaticAberrationEnabled={chromaticAberration}
      motionBlurEnabled={motionBlur}
      depthOfFieldEnabled={depthOfField || isInspecting}
      dofFocusDistance={isInspecting ? 0.5 : undefined}
      dofAperture={isInspecting ? 5.0 : undefined}
    />
  );
}
