/**
 * Game-specific hit marker wrapper — renders the engine hit marker and plays
 * pitch-scaled hit sounds based on consecutive hit count from combatStore.
 * Depends on: EngineHitMarker, audioManager, combatStore (consecutiveHits)
 * Used by: HudOverlay
 */
import { HitMarker as EngineHitMarker, pushHitMarker as enginePushHitMarker } from '@engine/hud';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';
import { useCombatStore } from '@game/stores/combatStore';

export { enginePushHitMarker as pushHitMarker };

/** Pitch multiplier ramps from 1.0 up to 2.0 over 10 consecutive hits. */
const HIT_PITCH = {
  BASE: 1.0,
  MAX: 2.0,
  RAMP_HITS: 10,
} as const;

export function HitMarker() {
  return (
    <EngineHitMarker
      onHit={(_isKill, isHeadshot) => {
        if (isHeadshot) {
          audioManager.play(SOUNDS.HEADSHOT, 0.05);
        } else {
          const hits = useCombatStore.getState().consecutiveHits;
          const t = Math.min(hits / HIT_PITCH.RAMP_HITS, 1);
          const pitchMult = HIT_PITCH.BASE + t * (HIT_PITCH.MAX - HIT_PITCH.BASE);
          audioManager.playAtPitch(SOUNDS.HIT_MARKER, pitchMult);
        }
      }}
    />
  );
}
