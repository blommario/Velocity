import { useGameStore } from '../../stores/gameStore';

/**
 * Full-screen overlay effects:
 * - Respawn fade: black overlay that fades out after respawn
 * - Death flash: red vignette that flashes on kill zone death
 */
export function ScreenEffects() {
  const respawnFade = useGameStore((s) => s.respawnFadeOpacity);
  const deathFlash = useGameStore((s) => s.deathFlashOpacity);

  return (
    <>
      {/* Respawn fade — black overlay */}
      {respawnFade > 0.01 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: respawnFade }}
        />
      )}

      {/* Death flash — red vignette */}
      {deathFlash > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: deathFlash,
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(200, 0, 0, 0.8) 100%)',
          }}
        />
      )}
    </>
  );
}
