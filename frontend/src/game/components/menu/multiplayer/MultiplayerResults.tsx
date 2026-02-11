/**
 * Multiplayer results screen — shows final placements, times, and deltas after match finishes.
 * Displayed when multiplayerStatus === 'finished'.
 *
 * Depends on: multiplayerStore (finishResults, currentRoom)
 * Used by: MultiplayerLobby
 */
import { useMultiplayerStore, type MultiplayerFinishResult } from '@game/stores/multiplayerStore';
import { useAuthStore } from '@game/stores/authStore';

const PLACEMENT_COLORS = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
} as const;

const PLACEMENT_LABELS = {
  1: '1st',
  2: '2nd',
  3: '3rd',
} as const;

function placementLabel(p: number): string {
  if (p in PLACEMENT_LABELS) return PLACEMENT_LABELS[p as keyof typeof PLACEMENT_LABELS];
  return `${p}th`;
}

function placementColor(p: number): string {
  if (p in PLACEMENT_COLORS) return PLACEMENT_COLORS[p as keyof typeof PLACEMENT_COLORS];
  return 'text-gray-400';
}

export function MultiplayerResults() {
  const finishResults = useMultiplayerStore((s) => s.finishResults);
  const currentRoom = useMultiplayerStore((s) => s.currentRoom);
  const disconnectFromMatch = useMultiplayerStore((s) => s.disconnectFromMatch);
  const playerId = useAuthStore((s) => s.playerId);

  const sorted = [...finishResults].sort((a, b) => {
    if (a.placement === 0 && b.placement === 0) return 0;
    if (a.placement === 0) return 1;
    if (b.placement === 0) return -1;
    return a.placement - b.placement;
  });

  const winnerTime = sorted.find((r) => r.placement === 1)?.finishTime ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black tracking-wider">RESULTS</h2>
        {currentRoom && (
          <p className="text-sm text-gray-400 mt-1">{currentRoom.mapName}</p>
        )}
      </div>

      {/* Results table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr_6rem_5rem] gap-2 px-4 py-2 border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wider">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Time</span>
          <span className="text-right">Delta</span>
        </div>

        {sorted.map((result) => (
          <ResultRow
            key={result.playerId}
            result={result}
            isLocal={result.playerId === playerId}
            winnerTime={winnerTime}
          />
        ))}

        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No results available
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={disconnectFromMatch}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg text-sm transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  isLocal,
  winnerTime,
}: {
  result: MultiplayerFinishResult;
  isLocal: boolean;
  winnerTime: number | null;
}) {
  const didFinish = result.finishTime !== null && result.placement > 0;
  const delta =
    didFinish && winnerTime !== null && result.placement > 1
      ? result.finishTime! - winnerTime
      : null;

  return (
    <div
      className={`grid grid-cols-[3rem_1fr_6rem_5rem] gap-2 px-4 py-3 border-b border-gray-800/50 ${
        isLocal ? 'bg-gray-800/60' : ''
      }`}
    >
      <span className={`font-bold ${didFinish ? placementColor(result.placement) : 'text-gray-600'}`}>
        {didFinish ? placementLabel(result.placement) : 'DNF'}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-medium text-sm">{result.playerName}</span>
        {isLocal && <span className="text-xs text-gray-500">(you)</span>}
      </span>
      <span className="text-right font-mono text-sm">
        {didFinish ? formatTime(result.finishTime!) : '--:--.---'}
      </span>
      <span className="text-right font-mono text-xs text-red-400">
        {delta !== null ? `+${formatTime(delta)}` : ''}
      </span>
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
