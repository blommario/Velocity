import { useGameStore, RUN_STATES, type SplitTime } from '../../stores/gameStore';

export function EndRunModal() {
  const runState = useGameStore((s) => s.runState);
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const stats = useGameStore((s) => s.stats);
  const splitTimes = useGameStore((s) => s.splitTimes);
  const resetRun = useGameStore((s) => s.resetRun);

  if (runState !== RUN_STATES.FINISHED) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto z-50">
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-8 min-w-[400px] max-w-[500px] text-white">
        <h2 className="text-3xl font-bold text-center mb-6 font-mono tabular-nums">
          {formatTime(elapsedMs)}
        </h2>

        {splitTimes.length > 0 && (
          <SplitTimesTable splits={splitTimes} />
        )}

        <StatsSection stats={stats} />

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              resetRun();
              document.querySelector('canvas')?.requestPointerLock();
            }}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded transition-colors cursor-pointer"
          >
            Retry
          </button>
          <button
            disabled
            className="flex-1 bg-gray-700 text-gray-500 font-bold py-3 px-4 rounded cursor-not-allowed"
            title="Coming soon"
          >
            Watch Replay
          </button>
        </div>
      </div>
    </div>
  );
}

function SplitTimesTable({ splits }: { splits: SplitTime[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">Splits</h3>
      <div className="space-y-1">
        {splits.map((split, i) => (
          <div key={split.checkpointIndex} className="flex justify-between font-mono text-sm">
            <span className="text-gray-400">CP {i + 1}</span>
            <span className="tabular-nums">{formatTime(split.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSection({ stats }: { stats: { maxSpeed: number; totalDistance: number; totalJumps: number; averageSpeed: number } }) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">Stats</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <StatRow label="Max Speed" value={`${Math.round(stats.maxSpeed)} u/s`} />
        <StatRow label="Avg Speed" value={`${Math.round(stats.averageSpeed)} u/s`} />
        <StatRow label="Distance" value={`${Math.round(stats.totalDistance)} u`} />
        <StatRow label="Jumps" value={`${stats.totalJumps}`} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
