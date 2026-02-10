/**
 * Game-specific reload indicator wrapper — reads combatStore reload state and renders the engine ReloadIndicator.
 * Depends on: engine ReloadIndicator, combatStore
 * Used by: HudOverlay
 */
import { ReloadIndicator as EngineReloadIndicator } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';

export function ReloadIndicator() {
  const isReloading = useCombatStore((s) => s.isReloading);
  const reloadProgress = useCombatStore((s) => s.reloadProgress);

  return (
    <EngineReloadIndicator
      active={isReloading}
      progress={reloadProgress}
    />
  );
}
