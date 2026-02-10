/**
 * Game-specific hit marker wrapper — renders the engine hit marker and plays the appropriate sound (normal or headshot) via AudioManager.
 * Depends on: EngineHitMarker, audioManager (SOUNDS.HIT_MARKER, SOUNDS.HEADSHOT)
 * Used by: HudOverlay
 */
import { HitMarker as EngineHitMarker, pushHitMarker as enginePushHitMarker } from '@engine/hud';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';

export { enginePushHitMarker as pushHitMarker };

export function HitMarker() {
  return (
    <EngineHitMarker
      onHit={(_isKill, isHeadshot) => {
        audioManager.play(isHeadshot ? SOUNDS.HEADSHOT : SOUNDS.HIT_MARKER, 0.08);
      }}
    />
  );
}
