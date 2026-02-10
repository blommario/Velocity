import { useEffect, useRef, useState } from 'react';
import { useGameStore, RUN_STATES, SCREENS, type SplitTime } from '@game/stores/gameStore';
import { useAuthStore } from '@game/stores/authStore';
import { useReplayStore, serializeReplay, deserializeReplay } from '@game/stores/replayStore';
import { submitRun } from '@game/services/runService';
import { submitReplay, getReplay } from '@game/services/replayService';
import { getLeaderboard } from '@game/services/leaderboardService';
import type { LeaderboardEntryResponse } from '@game/services/types';

const LEADERBOARD_DISPLAY_COUNT = 10;

export function EndRunModal() {
  const runState = useGameStore((s) => s.runState);
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const stats = useGameStore((s) => s.stats);
  const splitTimes = useGameStore((s) => s.splitTimes);
  const resetRun = useGameStore((s) => s.resetRun);
  const currentMapId = useGameStore((s) => s.currentMapId);
  const setScreen = useGameStore((s) => s.setScreen);
  const token = useAuthStore((s) => s.token);

  const [submitted, setSubmitted] = useState(false);
  const [isPb, setIsPb] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryResponse[]>([]);
  const [loadingGhost, setLoadingGhost] = useState(false);
  const submitRef = useRef(false);

  // Auto-submit run + fetch leaderboard when finished
  useEffect(() => {
    if (runState !== RUN_STATES.FINISHED) {
      submitRef.current = false;
      setSubmitted(false);
      setIsPb(false);
      setLeaderboard([]);
      return;
    }
    if (submitRef.current) return;
    submitRef.current = true;

    const timeSeconds = elapsedMs / 1000;

    if (token && currentMapId) {
      const replay = useReplayStore.getState().currentReplay;

      submitRun({
        mapId: currentMapId,
        time: timeSeconds,
        maxSpeed: stats.maxSpeed,
        averageSpeed: stats.averageSpeed,
        jumpCount: stats.totalJumps,
        rocketJumps: 0,
      })
        .then((res) => {
          setSubmitted(true);
          setIsPb(res.isPersonalBest);

          // Submit replay data if available
          if (replay) {
            submitReplay(res.id, serializeReplay(replay)).catch(() => {});
          }
        })
        .catch(() => setSubmitted(true));

      getLeaderboard(currentMapId)
        .then((res) => setLeaderboard(res.entries.slice(0, LEADERBOARD_DISPLAY_COUNT)))
        .catch(() => {});
    }
  }, [runState, elapsedMs, stats, token, currentMapId]);

  if (runState !== RUN_STATES.FINISHED) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto z-50">
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-8 min-w-[400px] max-w-[600px] text-white max-h-[90vh] overflow-y-auto">
        <h2 className="text-3xl font-bold text-center mb-1 font-mono tabular-nums">
          {formatTime(elapsedMs)}
        </h2>

        {isPb && submitted && (
          <div className="text-center text-green-400 text-sm font-bold mb-4">New Personal Best!</div>
        )}

        {splitTimes.length > 0 && (
          <SplitTimesTable splits={splitTimes} />
        )}

        <StatsSection stats={stats} />

        {leaderboard.length > 0 && (
          <LeaderboardSection entries={leaderboard} />
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              resetRun();
              document.querySelector('canvas')?.requestPointerLock?.()?.catch?.(() => {});
            }}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded transition-colors cursor-pointer"
          >
            Retry
          </button>
          {leaderboard.length > 0 && leaderboard[0].runId && (
            <button
              disabled={loadingGhost}
              onClick={() => {
                const wrRunId = leaderboard[0].runId;
                setLoadingGhost(true);
                getReplay(wrRunId)
                  .then((res) => {
                    const replay = deserializeReplay(res.replayDataJson);
                    useReplayStore.getState().loadGhost(replay);
                    resetRun();
                    document.querySelector('canvas')?.requestPointerLock?.()?.catch?.(() => {});
                  })
                  .catch(() => setLoadingGhost(false));
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-wait text-white font-bold py-3 px-4 rounded transition-colors cursor-pointer"
            >
              {loadingGhost ? 'Loading...' : 'Race WR'}
            </button>
          )}
          <button
            onClick={() => setScreen(SCREENS.MAIN_MENU)}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded transition-colors cursor-pointer"
          >
            Menu
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

function LeaderboardSection({ entries }: { entries: LeaderboardEntryResponse[] }) {
  return (
    <div className="border-t border-gray-700 pt-4 mt-4">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">Leaderboard</h3>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.rank} className="flex justify-between font-mono text-sm">
            <span className="text-gray-400 w-8">#{entry.rank}</span>
            <span className="flex-1 truncate text-white/80">{entry.playerName}</span>
            <span className="tabular-nums text-white ml-4">{formatTime(entry.time * 1000)}</span>
          </div>
        ))}
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
