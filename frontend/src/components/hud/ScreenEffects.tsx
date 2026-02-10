import { useMemo } from 'react';
import { ScreenEffects as EngineScreenEffects, type ScreenOverlay } from '../../engine/hud';
import { useGameStore } from '../../stores/gameStore';

export function ScreenEffects() {
  const respawnFade = useGameStore((s) => s.respawnFadeOpacity);
  const deathFlash = useGameStore((s) => s.deathFlashOpacity);

  const overlays: ScreenOverlay[] = useMemo(() => [
    { opacity: respawnFade, background: 'black' },
    { opacity: deathFlash, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(200, 0, 0, 0.8) 100%)' },
  ], [respawnFade, deathFlash]);

  return <EngineScreenEffects overlays={overlays} />;
}
