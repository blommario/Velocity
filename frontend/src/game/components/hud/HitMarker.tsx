/**
 * Game-specific hit marker wrapper — renders the engine hit marker and plays the hit sound effect via AudioManager on each hit.
 * Depends on: EngineHitMarker, audioManager (SOUNDS.HIT_MARKER)
 * Used by: HudOverlay
 */
import { HitMarker as EngineHitMarker, pushHitMarker as enginePushHitMarker } from '@engine/hud';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';

export { enginePushHitMarker as pushHitMarker };

export function HitMarker() {
  return (
    <EngineHitMarker
      onHit={() => audioManager.play(SOUNDS.HIT_MARKER, 0.08)}
    />
  );
}
