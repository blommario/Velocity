/**
 * Game-specific scope overlay wrapper — reads ADS progress, sway, and breath-hold state from combatStore and renders the engine sniper scope overlay (only for the sniper weapon).
 * Depends on: EngineScopeOverlay, combatStore, PHYSICS constants
 * Used by: HudOverlay
 */
import { ScopeOverlay as EngineScopeOverlay } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';
import { PHYSICS } from '../game/physics/constants';

export function ScopeOverlay() {
  const adsProgress = useCombatStore((s) => s.adsProgress);
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const swayX = useCombatStore((s) => s.scopeSwayX);
  const swayY = useCombatStore((s) => s.scopeSwayY);
  const isHoldingBreath = useCombatStore((s) => s.isHoldingBreath);
  const breathHoldTime = useCombatStore((s) => s.breathHoldTime);

  if (activeWeapon !== 'sniper') return null;

  return (
    <EngineScopeOverlay
      adsProgress={adsProgress}
      swayX={swayX}
      swayY={swayY}
      isHoldingBreath={isHoldingBreath}
      breathHoldTime={breathHoldTime}
      breathHoldMax={PHYSICS.SCOPE_BREATH_HOLD_DURATION}
    />
  );
}
