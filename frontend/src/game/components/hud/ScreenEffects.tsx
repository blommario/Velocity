/**
 * Game-specific screen effects wrapper — maps respawn fade and death flash opacity from gameStore into engine screen overlay layers.
 * Depends on: EngineScreenEffects, gameStore
 * Used by: HudOverlay
 */
import { useMemo } from 'react';
import { ScreenEffects as EngineScreenEffects, type ScreenOverlay } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function ScreenEffects() {
  const respawnFade = useGameStore((s) => s.respawnFadeOpacity);
  const deathFlash = useGameStore((s) => s.deathFlashOpacity);

  const overlays: ScreenOverlay[] = useMemo(() => [
    { opacity: respawnFade, background: 'black' },
    { opacity: deathFlash, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(200, 0, 0, 0.8) 100%)' },
  ], [respawnFade, deathFlash]);

  return <EngineScreenEffects overlays={overlays} />;
}
