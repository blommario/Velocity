/**
 * Game-specific damage numbers wrapper — reads player health from combatStore and passes it to the engine floating damage numbers display.
 * Depends on: EngineDamageNumbers, combatStore
 * Used by: HudOverlay
 */
import { DamageNumbers as EngineDamageNumbers } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';

export function DamageNumbers() {
  const health = useCombatStore((s) => s.health);
  return <EngineDamageNumbers health={health} />;
}
