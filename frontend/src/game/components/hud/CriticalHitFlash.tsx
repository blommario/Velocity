/**
 * Game-specific critical hit flash wrapper — reads lastCriticalHitTime from combatStore and renders the engine CriticalHitFlash overlay.
 * Depends on: EngineCriticalHitFlash, combatStore
 * Used by: HudOverlay
 */
import { CriticalHitFlash as EngineCriticalHitFlash } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';

export function CriticalHitFlash() {
  const lastCriticalTime = useCombatStore((s) => s.lastCriticalHitTime);

  return <EngineCriticalHitFlash lastCriticalTime={lastCriticalTime} />;
}
