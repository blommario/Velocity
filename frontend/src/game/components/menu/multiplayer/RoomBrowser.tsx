/**
 * Room browser UI for creating and joining multiplayer rooms.
 * Fetches available maps from the API for the map selector.
 *
 * Depends on: @game/stores/multiplayerStore, @game/services/mapService, @game/services/types
 * Used by: MultiplayerLobby
 */
import { useEffect, useState } from 'react';
import { useMultiplayerStore } from '@game/stores/multiplayerStore';
import { getMaps } from '@game/services/mapService';
import type { MapResponse, RoomResponse } from '@game/services/types';

const ROOM_STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  countdown: 'Starting...',
  racing: 'In Progress',
  finished: 'Finished',
} as const;

const ROOM_STATUS_COLORS: Record<string, string> = {
  waiting: 'text-green-400',
  countdown: 'text-yellow-400',
  racing: 'text-orange-400',
  finished: 'text-gray-500',
} as const;

export function RoomBrowser() {
  const rooms = useMultiplayerStore((s) => s.rooms);
  const isLoading = useMultiplayerStore((s) => s.isLoading);
  const error = useMultiplayerStore((s) => s.error);
  const fetchRooms = useMultiplayerStore((s) => s.fetchRooms);
  const joinRoom = useMultiplayerStore((s) => s.joinRoom);
  const createRoom = useMultiplayerStore((s) => s.createRoom);

  const [maps, setMaps] = useState<MapResponse[]>([]);
  const [selectedMapId, setSelectedMapId] = useState('');

  useEffect(() => {
    fetchRooms();
    getMaps({ isOfficial: true }).then((result) => {
      setMaps(result);
      if (result.length > 0 && !selectedMapId) {
        setSelectedMapId(result[0].id);
      }
    });
  }, [fetchRooms]);

  const handleCreate = () => {
    if (!selectedMapId) return;
    createRoom(selectedMapId);
  };

  const handleJoin = (room: RoomResponse) => {
    if (room.status !== 'waiting') return;
    joinRoom(room.id);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Create Room */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4">Create Room</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Map</label>
            <select
              value={selectedMapId}
              onChange={(e) => setSelectedMapId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.difficulty})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={isLoading || !selectedMapId}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded text-sm transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Room List */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Active Rooms</h2>
          <button
            onClick={fetchRooms}
            disabled={isLoading}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {rooms.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {isLoading ? 'Loading rooms...' : 'No active rooms. Create one!'}
          </p>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => (
              <RoomListItem key={room.id} room={room} onJoin={() => handleJoin(room)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoomListItem({ room, onJoin }: { room: RoomResponse; onJoin: () => void }) {
  const statusLabel = ROOM_STATUS_LABELS[room.status] ?? room.status;
  const statusColor = ROOM_STATUS_COLORS[room.status] ?? 'text-gray-400';
  const canJoin = room.status === 'waiting' && room.currentPlayers < room.maxPlayers;

  return (
    <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">{room.mapName}</span>
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Host: {room.hostName} | {room.currentPlayers}/{room.maxPlayers} players
        </div>
      </div>
      <button
        onClick={onJoin}
        disabled={!canJoin}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-1.5 px-4 rounded text-sm transition-colors"
      >
        Join
      </button>
    </div>
  );
}
