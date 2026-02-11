/**
 * Re-exports replay store and serialization utilities from the engine.
 *
 * Depends on: @engine/stores/replayStore
 * Used by: gameStore, GhostRenderer, GameCanvas
 */
// Re-export from engine for backward compatibility
export {
  useReplayStore,
  serializeReplay,
  deserializeReplay,
  type ReplayFrame,
  type ReplayData,
  type DeltaFrame,
} from '@engine/stores/replayStore';
