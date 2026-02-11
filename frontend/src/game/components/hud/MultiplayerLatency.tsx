/**
 * Game-specific latency indicator — reads connection state from multiplayerStore
 * and renders the engine LatencyIndicator only during an active multiplayer match.
 *
 * Depends on: EngineLatencyIndicator, multiplayerStore
 * Used by: HudOverlay
 */
import { LatencyIndicator as EngineLatencyIndicator } from '@engine/hud';
import { useMultiplayerStore } from '@game/stores/multiplayerStore';

export function MultiplayerLatency() {
  const isConnected = useMultiplayerStore((s) => s.isConnected);
  const latency = useMultiplayerStore((s) => s.latency);

  if (!isConnected) return null;

  return <EngineLatencyIndicator latencyMs={latency} />;
}
