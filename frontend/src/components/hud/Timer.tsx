import { useGameStore } from '../../stores/gameStore';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  return `${mm}:${ss}.${mmm}`;
}

export function Timer() {
  const elapsedMs = useGameStore((s) => s.elapsedMs);

  return (
    <div className="absolute top-6 left-6">
      <div className="font-mono text-3xl font-bold text-white/90 tabular-nums">
        {formatTime(elapsedMs)}
      </div>
    </div>
  );
}
