/**
 * Race multiplayer store — manages lobby state + WebSocket transport for real-time racing.
 * REST endpoints handle room CRUD; WebSocket handles position streaming + lifecycle events.
 *
 * Depends on: raceService (REST), GameTransport (WebSocket), PositionCodec (binary)
 * Used by: RaceLobby, RoomBrowser, RoomLobby, CountdownOverlay, RemotePlayers (future T2)
 */
import { create } from 'zustand';
import type { RoomResponse } from '@game/services/types';
import {
  getActiveRooms,
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  setReady as apiSetReady,
  startRace as apiStartRace,
} from '@game/services/raceService';
import { STORAGE_KEYS } from '@game/services/api';
import {
  WebSocketTransport,
  buildWsUrl,
  decodeBatch,
  type IGameTransport,
  type PositionSnapshot,
} from '@engine/networking';

type Vec3 = [number, number, number];

interface RacePosition {
  position: Vec3;
  yaw: number;
  pitch: number;
  speed: number;
  checkpoint: number;
  timestamp: number;
}

interface RaceState {
  // State
  currentRoom: RoomResponse | null;
  rooms: RoomResponse[];
  isConnected: boolean;
  countdown: number | null;
  racePositions: Map<string, RacePosition>;
  localSlot: number;
  latency: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRooms: () => Promise<void>;
  createRoom: (mapId: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  setReady: () => Promise<void>;
  startRace: () => Promise<void>;
  connectToRace: (roomId: string) => void;
  disconnectFromRace: () => void;
  updatePosition: (playerId: string, position: Vec3, yaw: number, pitch: number) => void;
  setCountdown: (n: number | null) => void;
  resetRace: () => void;
  getTransport: () => IGameTransport | null;
}

let transport: WebSocketTransport | null = null;

/** Slot-to-playerId mapping, populated by room_snapshot and player_joined events. */
const slotToPlayer = new Map<number, { playerId: string; playerName: string }>();

export const useRaceStore = create<RaceState>((set, get) => ({
  currentRoom: null,
  rooms: [],
  isConnected: false,
  countdown: null,
  racePositions: new Map(),
  localSlot: -1,
  latency: 0,
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const rooms = await getActiveRooms();
      set({ rooms, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to fetch rooms',
      });
    }
  },

  createRoom: async (mapId: string) => {
    set({ isLoading: true, error: null });
    try {
      const room = await apiCreateRoom(mapId);
      set({ currentRoom: room, isLoading: false });
      get().connectToRace(room.id);
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to create room',
      });
    }
  },

  joinRoom: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const room = await apiJoinRoom(roomId);
      set({ currentRoom: room, isLoading: false });
      get().connectToRace(room.id);
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to join room',
      });
    }
  },

  setReady: async () => {
    const room = get().currentRoom;
    if (!room) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await apiSetReady(room.id);
      set({ currentRoom: updated, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to set ready',
      });
    }
  },

  startRace: async () => {
    const room = get().currentRoom;
    if (!room) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await apiStartRace(room.id);
      set({ currentRoom: updated, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to start race',
      });
    }
  },

  connectToRace: (roomId: string) => {
    // Close existing connection
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    slotToPlayer.clear();

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    transport = new WebSocketTransport();

    // Binary position batch handler
    transport.onBinary((buffer: ArrayBuffer) => {
      const { count, snapshots } = decodeBatch(buffer);
      const positions = new Map(get().racePositions);

      for (let i = 0; i < count; i++) {
        const snap: PositionSnapshot = snapshots[i];
        const playerInfo = slotToPlayer.get(snap.slot);
        if (!playerInfo) continue;

        positions.set(playerInfo.playerId, {
          position: [snap.posX, snap.posY, snap.posZ],
          yaw: snap.yaw,
          pitch: snap.pitch,
          speed: snap.speed,
          checkpoint: snap.checkpoint,
          timestamp: snap.timestamp,
        });
      }

      set({ racePositions: positions });
    });

    // JSON event handlers
    transport.onJson<{ roomId: string; players: Array<{ playerId: string; name: string; slot: number }>; yourSlot: number }>(
      'room_snapshot',
      (data) => {
        slotToPlayer.clear();
        for (const p of data.players) {
          slotToPlayer.set(p.slot, { playerId: p.playerId, playerName: p.name });
        }
        set({ localSlot: data.yourSlot });
      },
    );

    transport.onJson<{ playerId: string; playerName: string; slot: number }>(
      'player_joined',
      (data) => {
        slotToPlayer.set(data.slot, { playerId: data.playerId, playerName: data.playerName });
      },
    );

    transport.onJson<{ playerId: string; playerName: string; slot: number }>(
      'player_left',
      (data) => {
        slotToPlayer.delete(data.slot);
        const positions = new Map(get().racePositions);
        positions.delete(data.playerId);
        set({ racePositions: positions });
      },
    );

    transport.onJson<{ countdown: number }>('countdown', (data) => {
      set({ countdown: data.countdown });
    });

    transport.onJson<{ playerId: string; playerName: string; finishTime: number; placement: number }>(
      'player_finished',
      (data) => {
        const room = get().currentRoom;
        if (!room) return;
        const updatedParticipants = room.participants.map((p) =>
          p.playerId === data.playerId
            ? { ...p, finishTime: data.finishTime }
            : p,
        );
        set({ currentRoom: { ...room, participants: updatedParticipants } });
      },
    );

    transport.onJson<{ room: RoomResponse }>('room_update', (data) => {
      set({ currentRoom: data.room });
    });

    transport.onJson<{ roomId: string }>('race_starting', () => {
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: 'countdown' } });
      }
    });

    transport.onOpen(() => {
      set({ isConnected: true });
    });

    transport.onClose((_code, _reason) => {
      set({ isConnected: false });
    });

    // Connect
    const wsUrl = buildWsUrl(`/ws/race/${roomId}`);
    transport.connect(wsUrl, token);
  },

  disconnectFromRace: () => {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    slotToPlayer.clear();
    set({
      isConnected: false,
      currentRoom: null,
      countdown: null,
      racePositions: new Map(),
      localSlot: -1,
      latency: 0,
    });
  },

  updatePosition: (playerId: string, position: Vec3, yaw: number, pitch: number) => {
    const positions = new Map(get().racePositions);
    positions.set(playerId, { position, yaw, pitch, speed: 0, checkpoint: 0, timestamp: 0 });
    set({ racePositions: positions });
  },

  setCountdown: (n: number | null) => {
    set({ countdown: n });
  },

  resetRace: () => {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    slotToPlayer.clear();
    set({
      currentRoom: null,
      rooms: [],
      isConnected: false,
      countdown: null,
      racePositions: new Map(),
      localSlot: -1,
      latency: 0,
      isLoading: false,
      error: null,
    });
  },

  getTransport: () => transport,
}));
