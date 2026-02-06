import { useGameStore, RUN_STATES } from '../../stores/gameStore';

export function TrackProgressBar() {
  const current = useGameStore((s) => s.currentCheckpoint);
  const total = useGameStore((s) => s.totalCheckpoints);
  const runState = useGameStore((s) => s.runState);

  if (total === 0) return null;

  // +1 because finish zone is after all checkpoints
  const segments = total + 1;
  const progress = runState === RUN_STATES.FINISHED ? 1 : current / segments;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
      <div
        className="h-full bg-green-400/80 transition-[width] duration-300 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
      {/* Checkpoint markers */}
      {Array.from({ length: total }, (_, i) => {
        const pos = ((i + 1) / segments) * 100;
        return (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5"
            style={{
              left: `${pos}%`,
              backgroundColor: i < current ? 'rgba(74, 222, 128, 0.6)' : 'rgba(255, 255, 255, 0.3)',
            }}
          />
        );
      })}
    </div>
  );
}
