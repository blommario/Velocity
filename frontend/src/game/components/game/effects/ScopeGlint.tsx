/**
 * Lens flare glint effect visible when the sniper scope is fully ADS.
 * Feeds player position and look direction to the engine ScopeGlint effect.
 *
 * Depends on: @engine/effects, @game/stores/combatStore, @game/stores/gameStore
 * Used by: GameCanvas
 */
import { useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { ScopeGlint as EngineScopeGlint, type ScopeGlintState } from '@engine/effects';
import { useCombatStore } from '@game/stores/combatStore';
import { useGameStore } from '@game/stores/gameStore';
import { Vector3 } from 'three';

const _fwd = new Vector3();

export function ScopeGlint() {
  const camera = useThree((s) => s.camera);

  const getState = useCallback((): ScopeGlintState | null => {
    const { adsProgress, activeWeapon } = useCombatStore.getState();
    if (activeWeapon !== 'sniper' || adsProgress < 0.9) return null;

    const pos = useGameStore.getState().position;
    camera.getWorldDirection(_fwd);

    return {
      position: [pos[0], pos[1] + 1.6, pos[2]],
      forward: [_fwd.x, _fwd.y, _fwd.z],
      intensity: adsProgress,
    };
  }, [camera]);

  return <EngineScopeGlint getState={getState} />;
}
