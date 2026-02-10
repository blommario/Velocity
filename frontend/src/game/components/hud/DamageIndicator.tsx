/**
 * Game-specific damage indicator wrapper — reads player health from combatStore and passes it to the engine damage vignette overlay.
 * Depends on: EngineDamageIndicator, combatStore
 * Used by: HudOverlay
 */
import { DamageIndicator as EngineDamageIndicator } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';

export function DamageIndicator() {
  const health = useCombatStore((s) => s.health);
  return <EngineDamageIndicator health={health} />;
}
