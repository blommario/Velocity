/**
 * Game-specific speed meter wrapper — reads the current player speed from gameStore and passes it to the engine SpeedMeter display with Velocity speed tiers.
 * Depends on: EngineSpeedMeter, gameStore
 * Used by: HudOverlay
 */
import { SpeedMeter as EngineSpeedMeter, type SpeedTier } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';
import { PHYSICS } from '@game/components/game/physics/constants';

const SPEED_TIERS: readonly SpeedTier[] = [
  { speed: PHYSICS.SPEED_TIER_3, label: 'MACH', color: '#ff2020' },
  { speed: PHYSICS.SPEED_TIER_2, label: 'HYPER', color: '#ff8c00' },
  { speed: PHYSICS.SPEED_TIER_1, label: 'FAST', color: '#ffd700' },
] as const;

export function SpeedMeter() {
  const speed = useGameStore((s) => s.speed);
  return <EngineSpeedMeter speed={speed} tiers={SPEED_TIERS} />;
}
