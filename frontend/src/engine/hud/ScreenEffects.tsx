/**
 * Composable full-screen color/gradient overlays.
 *
 * Depends on: —
 * Used by: game HUD composition (speed boost, damage flash, etc.)
 */
export interface ScreenOverlay {
  /** Opacity 0–1 (0 = hidden) */
  opacity: number;
  /** CSS background (color, gradient, etc.) */
  background: string;
}

export interface ScreenEffectsProps {
  overlays: readonly ScreenOverlay[];
}

export function ScreenEffects({ overlays }: ScreenEffectsProps) {
  return (
    <>
      {overlays.map((overlay, i) =>
        overlay.opacity > 0.01 ? (
          <div
            key={i}
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: overlay.opacity, background: overlay.background }}
          />
        ) : null,
      )}
    </>
  );
}
