/**
 * Registers beforeunload / pagehide listeners that tear down all
 * long-lived resources (audio, network, asset caches) when the
 * browser tab or window is closed.
 *
 * Depends on: audioManager, multiplayerStore, assetManager
 * Used by: App
 */
import { useEffect } from 'react';
import { audioManager } from '@engine/audio/AudioManager';
import { useMultiplayerStore } from '@game/stores/multiplayerStore';
import { clearAssetCache } from '@game/services/assetManager';
import { devLog } from '@engine/stores/devLogStore';

export function useAppCleanup(): void {
  useEffect(() => {
    const cleanup = () => {
      devLog.info('Cleanup', 'Disposing resources on page unload');

      // Network — disconnect WebSocket + clear latency interval
      useMultiplayerStore.getState().disconnectFromMatch();

      // Audio — close AudioContext + release buffers
      audioManager.dispose();

      // Assets — dispose cached textures, models, HDRI
      clearAssetCache();
    };

    // pagehide fires reliably on tab/window close in modern browsers,
    // including mobile. beforeunload is the fallback for older browsers.
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('beforeunload', cleanup);

    return () => {
      window.removeEventListener('pagehide', cleanup);
      window.removeEventListener('beforeunload', cleanup);
    };
  }, []);
}
