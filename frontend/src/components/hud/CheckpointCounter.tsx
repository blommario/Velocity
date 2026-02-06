import { useGameStore } from '../../stores/gameStore';

export function CheckpointCounter() {
  const current = useGameStore((s) => s.currentCheckpoint);
  const total = useGameStore((s) => s.totalCheckpoints);

  if (total === 0) return null;

  return (
    <div className="absolute top-4 right-6 font-mono text-sm text-white/80">
      CP {current}/{total}
    </div>
  );
}
