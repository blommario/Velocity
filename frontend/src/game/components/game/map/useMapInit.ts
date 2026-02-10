/**
 * Map initialization hook — sets up game state, resets physics/combat pools,
 * and clears asset cache on unmount.
 *
 * Depends on: gameStore, combatStore, assetManager, projectilePool, usePhysicsTick
 * Used by: MapLoader
 */
import { useEffect } from 'react';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';
import { devLog } from '@engine/stores/devLogStore';
import { resetPool } from '../physics/projectilePool';
import { resetPhysicsTickState } from '../physics/usePhysicsTick';
import { clearAssetCache } from '@game/services/assetManager';
import type { MapData } from './types';

export function useMapInit(data: MapData, mapId: string | undefined, spawnYaw: number) {
  useEffect(() => {
    devLog.info('Map', `Loading map "${mapId ?? 'unknown'}" (${data.blocks.length} blocks, ${data.checkpoints.length} checkpoints)`);
    useGameStore.getState().initRun({
      checkpointCount: data.checkpoints.length,
      spawnPoint: data.spawnPoint,
      spawnYaw,
      mapId,
    });
    resetPool();
    resetPhysicsTickState();
    useCombatStore.getState().resetCombat(
      data.settings?.maxRocketAmmo ?? 10,
      data.settings?.maxGrenadeAmmo ?? 3,
    );
    devLog.success('Map', `Map loaded — spawn at [${data.spawnPoint.map(v => v.toFixed(0)).join(', ')}]`);
    useGameStore.getState().setLoadProgress(0.8, 'Compiling shaders...');

    return () => {
      clearAssetCache();
      devLog.info('Map', 'Asset cache cleared on map change');
    };
  }, [data, mapId, spawnYaw]);
}
