/**
 * Game-specific latency indicator — reads connection state from raceStore
 * and renders the engine LatencyIndicator only during an active multiplayer race.
 *
 * Depends on: EngineLatencyIndicator, raceStore
 * Used by: HudOverlay
 */
import { LatencyIndicator as EngineLatencyIndicator } from '@engine/hud';
import { useRaceStore } from '@game/stores/raceStore';

export function RaceLatency() {
  const isConnected = useRaceStore((s) => s.isConnected);
  const latency = useRaceStore((s) => s.latency);

  if (!isConnected) return null;

  return <EngineLatencyIndicator latencyMs={latency} />;
}
