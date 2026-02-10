import { create } from 'zustand';
import type { RoomResponse } from '@game/services/types';
import type {
  RaceCountdownEvent,
  RacePositionEvent,
  RacePlayerFinishedEvent,
  RaceRoomUpdateEvent,
} from '@game/services/types';
import {
  getActiveRooms,
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  setReady as apiSetReady,
  startRace as apiStartRace,
} from '@game/services/raceService';
import { createTypedSseStream } from '@game/services/sseClient';

type Vec3 = [number, number, number];

interface RacePosition {
  position: Vec3;
  yaw: number;
  pitch: number;
}

interface RaceState {
  // State
  currentRoom: RoomResponse | null;
  rooms: RoomResponse[];
  isConnected: boolean;
  countdown: number | null;
  racePositions: Map<string, RacePosition>;
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
}

let sseCleanup: (() => void) | null = null;

export const useRaceStore = create<RaceState>((set, get) => ({
  currentRoom: null,
  rooms: [],
  isConnected: false,
  countdown: null,
  racePositions: new Map(),
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
    // Close existing connection if any
    if (sseCleanup) {
      sseCleanup();
      sseCleanup = null;
    }

    const connection = createTypedSseStream<{
      countdown: RaceCountdownEvent;
      position: RacePositionEvent;
      playerFinished: RacePlayerFinishedEvent;
      roomUpdate: RaceRoomUpdateEvent;
      message: RaceRoomUpdateEvent;
    }>(
      `/sse/race/${roomId}`,
      {
        countdown: (data: RaceCountdownEvent) => {
          set({ countdown: data.countdown });
        },
        position: (data: RacePositionEvent) => {
          const positions = new Map(get().racePositions);
          positions.set(data.playerId, {
            position: data.position,
            yaw: data.yaw,
            pitch: data.pitch,
          });
          set({ racePositions: positions });
        },
        playerFinished: (data: RacePlayerFinishedEvent) => {
          const room = get().currentRoom;
          if (!room) return;
          const updatedParticipants = room.participants.map((p) =>
            p.playerId === data.playerId
              ? { ...p, finishTime: data.finishTime }
              : p,
          );
          set({
            currentRoom: { ...room, participants: updatedParticipants },
          });
        },
        roomUpdate: (data: RaceRoomUpdateEvent) => {
          set({ currentRoom: data.room });
        },
        message: (data: RaceRoomUpdateEvent) => {
          set({ currentRoom: data.room });
        },
      },
      (connected: boolean) => {
        set({ isConnected: connected });
      },
    );

    sseCleanup = connection.close;
  },

  disconnectFromRace: () => {
    if (sseCleanup) {
      sseCleanup();
      sseCleanup = null;
    }
    set({ isConnected: false, currentRoom: null, countdown: null, racePositions: new Map() });
  },

  updatePosition: (playerId: string, position: Vec3, yaw: number, pitch: number) => {
    const positions = new Map(get().racePositions);
    positions.set(playerId, { position, yaw, pitch });
    set({ racePositions: positions });
  },

  setCountdown: (n: number | null) => {
    set({ countdown: n });
  },

  resetRace: () => {
    if (sseCleanup) {
      sseCleanup();
      sseCleanup = null;
    }
    set({
      currentRoom: null,
      rooms: [],
      isConnected: false,
      countdown: null,
      racePositions: new Map(),
      isLoading: false,
      error: null,
    });
  },
}));
