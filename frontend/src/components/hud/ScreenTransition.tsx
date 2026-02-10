import { ScreenTransition as EngineScreenTransition } from '../../engine/hud';
import { useGameStore } from '../../stores/gameStore';

export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const screen = useGameStore((s) => s.screen);
  return (
    <EngineScreenTransition screenKey={screen}>
      {children}
    </EngineScreenTransition>
  );
}
