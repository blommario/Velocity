/**
 * Full-screen countdown overlay (3, 2, 1, GO!) for multiplayer match starts.
 *
 * Depends on: none
 * Used by: MultiplayerLobby
 */
const COUNTDOWN_LABELS: Record<number, string> = {
  3: '3',
  2: '2',
  1: '1',
  0: 'GO!',
} as const;

const COUNTDOWN_COLORS: Record<number, string> = {
  3: 'text-red-500',
  2: 'text-yellow-500',
  1: 'text-green-400',
  0: 'text-green-300',
} as const;

const DEFAULT_COLOR = 'text-white';

interface CountdownOverlayProps {
  countdown: number;
}

export function CountdownOverlay({ countdown }: CountdownOverlayProps) {
  const label = COUNTDOWN_LABELS[countdown] ?? String(countdown);
  const color = COUNTDOWN_COLORS[countdown] ?? DEFAULT_COLOR;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 pointer-events-none">
      <div className={`text-9xl font-black ${color} animate-pulse drop-shadow-lg`}>
        {label}
      </div>
    </div>
  );
}
