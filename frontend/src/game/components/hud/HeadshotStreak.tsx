/**
 * Game-specific headshot streak wrapper — reads streak state from combatStore and renders the engine HeadshotStreak component.
 * Depends on: EngineHeadshotStreak, combatStore, PHYSICS constants
 * Used by: HudOverlay
 */
import { HeadshotStreak as EngineHeadshotStreak } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';
import { PHYSICS } from '../game/physics/constants';

export function HeadshotStreak() {
  const count = useCombatStore((s) => s.headshotStreak);
  const lastTime = useCombatStore((s) => s.lastHeadshotTime);

  return (
    <EngineHeadshotStreak
      count={count}
      lastTime={lastTime}
      fadeDelay={PHYSICS.HEADSHOT_STREAK_FADE_DELAY}
    />
  );
}
