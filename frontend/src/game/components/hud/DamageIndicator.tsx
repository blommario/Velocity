import { DamageIndicator as EngineDamageIndicator } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';

export function DamageIndicator() {
  const health = useCombatStore((s) => s.health);
  return <EngineDamageIndicator health={health} />;
}
