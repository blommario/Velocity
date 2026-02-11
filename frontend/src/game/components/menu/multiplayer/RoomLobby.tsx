/**
 * Room lobby — shows participants, ready state, and host controls.
 * T1: adds kick button for host, leave via WebSocket, racing status display.
 *
 * Depends on: raceStore, authStore
 * Used by: RaceLobby
 */
import { useRaceStore } from '@game/stores/raceStore';
import { useAuthStore } from '@game/stores/authStore';
import type { ParticipantResponse } from '@game/services/types';

const READY_STATUS = {
  READY: 'Ready',
  NOT_READY: 'Not Ready',
} as const;

const READY_COLORS = {
  ready: 'text-green-400',
  notReady: 'text-gray-500',
} as const;

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  countdown: 'Starting...',
  racing: 'Racing',
  finished: 'Finished',
} as const;

const STATUS_COLORS: Record<string, string> = {
  waiting: 'text-green-400',
  countdown: 'text-yellow-400',
  racing: 'text-orange-400',
  finished: 'text-gray-400',
} as const;

export function RoomLobby() {
  const currentRoom = useRaceStore((s) => s.currentRoom);
  const isConnected = useRaceStore((s) => s.isConnected);
  const isLoading = useRaceStore((s) => s.isLoading);
  const error = useRaceStore((s) => s.error);
  const raceStatus = useRaceStore((s) => s.raceStatus);
  const setReady = useRaceStore((s) => s.setReady);
  const startRace = useRaceStore((s) => s.startRace);
  const sendLeave = useRaceStore((s) => s.sendLeave);
  const sendKick = useRaceStore((s) => s.sendKick);
  const disconnectFromRace = useRaceStore((s) => s.disconnectFromRace);
  const playerId = useAuthStore((s) => s.playerId);

  if (!currentRoom) return null;

  const isHost = currentRoom.hostPlayerId === playerId;
  const currentParticipant = currentRoom.participants.find((p) => p.playerId === playerId);
  const isReady = currentParticipant?.isReady ?? false;
  const allReady = currentRoom.participants.length > 0 &&
    currentRoom.participants.every((p) => p.isReady || p.playerId === currentRoom.hostPlayerId);
  const isWaiting = currentRoom.status === 'waiting';
  const statusLabel = STATUS_LABELS[currentRoom.status] ?? currentRoom.status;
  const statusColor = STATUS_COLORS[currentRoom.status] ?? 'text-gray-400';

  const handleLeave = () => {
    if (raceStatus === 'racing' || raceStatus === 'countdown') {
      sendLeave();
    }
    disconnectFromRace();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Room Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">{currentRoom.mapName}</h2>
            <p className="text-sm text-gray-400 mt-1">
              Hosted by {currentRoom.hostName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          {currentRoom.currentPlayers}/{currentRoom.maxPlayers} players
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Participants */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          Participants
        </h3>
        <div className="space-y-2">
          {currentRoom.participants.map((p) => (
            <ParticipantRow
              key={p.playerId}
              participant={p}
              isCurrentPlayer={p.playerId === playerId}
              isHost={p.playerId === currentRoom.hostPlayerId}
              canKick={isHost && p.playerId !== playerId && isWaiting}
              onKick={() => sendKick(p.playerId)}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!isReady && isWaiting && (
          <button
            onClick={setReady}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors"
          >
            {isLoading ? 'Updating...' : 'Ready Up'}
          </button>
        )}
        {isHost && allReady && isWaiting && currentRoom.participants.length >= 2 && (
          <button
            onClick={startRace}
            disabled={isLoading}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors"
          >
            {isLoading ? 'Starting...' : 'Start Race'}
          </button>
        )}
        <button
          onClick={handleLeave}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-sm transition-colors"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant,
  isCurrentPlayer,
  isHost,
  canKick,
  onKick,
}: {
  participant: ParticipantResponse;
  isCurrentPlayer: boolean;
  isHost: boolean;
  canKick: boolean;
  onKick: () => void;
}) {
  const readyText = participant.isReady ? READY_STATUS.READY : READY_STATUS.NOT_READY;
  const readyColor = participant.isReady ? READY_COLORS.ready : READY_COLORS.notReady;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-lg ${
        isCurrentPlayer ? 'bg-gray-800/80 border border-gray-600' : 'bg-gray-800/30'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{participant.playerName}</span>
        {isHost && (
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-1.5 py-0.5 rounded">
            Host
          </span>
        )}
        {isCurrentPlayer && (
          <span className="text-xs text-gray-500">(you)</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {participant.finishTime !== null && (
          <span className="text-xs font-mono text-blue-400">
            {formatTime(participant.finishTime)}
          </span>
        )}
        <span className={`text-xs font-medium ${readyColor}`}>{readyText}</span>
        {canKick && (
          <button
            onClick={onKick}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Kick
          </button>
        )}
      </div>
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
