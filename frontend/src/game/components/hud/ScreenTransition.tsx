/**
 * Game-specific screen transition wrapper — reads the active screen from gameStore and passes it as a transition key to the engine ScreenTransition component.
 * Depends on: EngineScreenTransition, gameStore
 * Used by: App (wraps screen-level content for animated transitions)
 */
import { ScreenTransition as EngineScreenTransition } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';

export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const screen = useGameStore((s) => s.screen);
  return (
    <EngineScreenTransition screenKey={screen}>
      {children}
    </EngineScreenTransition>
  );
}
