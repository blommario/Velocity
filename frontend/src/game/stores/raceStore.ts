/**
 * Race multiplayer store — manages lobby state + WebSocket transport for real-time racing.
 * REST endpoints handle room CRUD; WebSocket handles position streaming + lifecycle events.
 * T1: adds race_start/race_finished/player_finished/host_changed/player_kicked,
 * raceStartTime for synced timer, clockOffset calibration, finish results tracking.
 *
 * Depends on: raceService (REST), GameTransport (WebSocket), PositionCodec (binary)
 * Used by: RaceLobby, RoomBrowser, RoomLobby, CountdownOverlay, RaceResults, RemotePlayers (T2)
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

export interface RacePosition {
  position: Vec3;
  yaw: number;
  pitch: number;
  speed: number;
  checkpoint: number;
  timestamp: number;
}

export interface RaceFinishResult {
  playerId: string;
  playerName: string;
  finishTime: number | null;
  placement: number;
  slot: number;
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

  // T1: Race lifecycle state
  raceStartTime: number | null;
  clockOffset: number;
  raceStatus: 'lobby' | 'countdown' | 'racing' | 'finished';
  finishResults: RaceFinishResult[];
  localFinished: boolean;
  disconnectedMessage: string | null;

  // Actions
  fetchRooms: () => Promise<void>;
  createRoom: (mapId: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  setReady: () => Promise<void>;
  startRace: () => Promise<void>;
  connectToRace: (roomId: string) => void;
  disconnectFromRace: () => void;
  sendFinish: (finishTimeMs: number) => void;
  sendLeave: () => void;
  sendKick: (targetPlayerId: string) => void;
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
  raceStartTime: null,
  clockOffset: 0,
  raceStatus: 'lobby',
  finishResults: [],
  localFinished: false,
  disconnectedMessage: null,

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

    // ── JSON event handlers ──

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
      set({ countdown: data.countdown, raceStatus: 'countdown' });
    });

    // T1: race_start — server sends raceStartTime (epoch ms)
    transport.onJson<{ raceStartTime: number }>('race_start', (data) => {
      set({
        raceStartTime: data.raceStartTime,
        raceStatus: 'racing',
        countdown: null,
        localFinished: false,
        finishResults: [],
      });
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: 'racing' } });
      }
    });

    // T1: player_finished — server broadcasts each finisher
    transport.onJson<{ playerId: string; playerName: string; finishTime: number; placement: number }>(
      'player_finished',
      (data) => {
        const room = get().currentRoom;
        if (room) {
          const updatedParticipants = room.participants.map((p) =>
            p.playerId === data.playerId ? { ...p, finishTime: data.finishTime } : p,
          );
          set({ currentRoom: { ...room, participants: updatedParticipants } });
        }

        // Add to finish results
        const existing = get().finishResults;
        const slot = findSlotByPlayerId(data.playerId);
        set({
          finishResults: [
            ...existing,
            {
              playerId: data.playerId,
              playerName: data.playerName,
              finishTime: data.finishTime,
              placement: data.placement,
              slot: slot ?? -1,
            },
          ],
        });
      },
    );

    // T1: race_finished — all done or timeout
    transport.onJson<{ results: RaceFinishResult[] }>('race_finished', (data) => {
      set({
        raceStatus: 'finished',
        finishResults: data.results,
      });
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: 'finished' } });
      }
    });

    // T1: host_changed — host succession
    transport.onJson<{ playerId: string; playerName: string }>('host_changed', (data) => {
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, hostPlayerId: data.playerId, hostName: data.playerName } });
      }
    });

    // T1: player_kicked — someone was kicked
    transport.onJson<{ playerId: string; playerName: string }>('player_kicked', (data) => {
      slotToPlayer.forEach((val, key) => {
        if (val.playerId === data.playerId) slotToPlayer.delete(key);
      });
      const positions = new Map(get().racePositions);
      positions.delete(data.playerId);
      set({ racePositions: positions });
    });

    // T1: room_closed — server killed the room
    transport.onJson<{ reason: string }>('room_closed', (data) => {
      set({ disconnectedMessage: data.reason });
    });

    transport.onJson<{ room: RoomResponse }>('room_update', (data) => {
      set({ currentRoom: data.room });
    });

    transport.onJson<{ roomId: string }>('race_starting', () => {
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: 'countdown' }, raceStatus: 'countdown' });
      }
    });

    transport.onOpen(() => {
      set({ isConnected: true, disconnectedMessage: null });
    });

    transport.onClose((_code, reason) => {
      set({ isConnected: false });
      if (!get().disconnectedMessage && reason) {
        set({ disconnectedMessage: reason || 'Connection lost' });
      }
    });

    // Connect
    const wsUrl = buildWsUrl(`/ws/race/${roomId}`);
    transport.connect(wsUrl, token);
  },

  // T1: Send finish time to server via WebSocket
  sendFinish: (finishTimeMs: number) => {
    if (!transport || get().localFinished) return;
    set({ localFinished: true });
    transport.sendJson('finish', { finishTime: finishTimeMs } as Record<string, unknown>);
  },

  // T1: Request leave via WebSocket
  sendLeave: () => {
    if (!transport) return;
    transport.sendJson('leave');
  },

  // T1: Host kicks a player via WebSocket
  sendKick: (targetPlayerId: string) => {
    if (!transport) return;
    transport.sendJson('kick', { targetPlayerId } as Record<string, unknown>);
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
      raceStartTime: null,
      clockOffset: 0,
      raceStatus: 'lobby',
      finishResults: [],
      localFinished: false,
      disconnectedMessage: null,
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
      raceStartTime: null,
      clockOffset: 0,
      raceStatus: 'lobby',
      finishResults: [],
      localFinished: false,
      disconnectedMessage: null,
    });
  },

  getTransport: () => transport,
}));

/** Helper to find a slot by playerId from the module-level slotToPlayer map. */
function findSlotByPlayerId(playerId: string): number | undefined {
  for (const [slot, info] of slotToPlayer) {
    if (info.playerId === playerId) return slot;
  }
  return undefined;
}
