import { DamageNumbers as EngineDamageNumbers } from '../../engine/hud';
import { useCombatStore } from '../../stores/combatStore';

export function DamageNumbers() {
  const health = useCombatStore((s) => s.health);
  return <EngineDamageNumbers health={health} />;
}
