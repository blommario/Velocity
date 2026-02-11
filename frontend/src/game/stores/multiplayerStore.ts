/**
 * Multiplayer store — manages lobby state + WebSocket transport for real-time racing.
 * REST endpoints handle room CRUD; WebSocket handles position streaming + lifecycle events.
 * T1: adds match_start/match_finished/player_finished/host_changed/player_kicked,
 * multiplayerStartTime for synced timer, clockOffset calibration, finish results tracking.
 *
 * Depends on: multiplayerService (REST), GameTransport (WebSocket), PositionCodec (binary)
 * Used by: MultiplayerLobby, RoomBrowser, RoomLobby, CountdownOverlay, MultiplayerResults, RemotePlayers (T2)
 */
import { create } from 'zustand';
import type { RoomResponse } from '@game/services/types';
import {
  getActiveRooms,
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  setReady as apiSetReady,
  startMatch as apiStartMatch,
} from '@game/services/multiplayerService';
import { STORAGE_KEYS } from '@game/services/api';
import { useGameStore } from '@game/stores/gameStore';
import { OFFICIAL_MAP_BY_ID, OFFICIAL_MAPS } from '@game/components/game/map/official';
import { getMap } from '@game/services/mapService';
import type { MapData } from '@game/components/game/map/types';
import {
  WebSocketTransport,
  buildWsUrl,
  decodeBatch,
  type IGameTransport,
  type PositionSnapshot,
} from '@engine/networking';
import { devLog } from '@engine/stores/devLogStore';

type Vec3 = [number, number, number];

export interface MultiplayerPosition {
  position: Vec3;
  yaw: number;
  pitch: number;
  speed: number;
  checkpoint: number;
  timestamp: number;
}

export interface MultiplayerFinishResult {
  playerId: string;
  playerName: string;
  finishTime: number | null;
  placement: number;
  slot: number;
}

interface MultiplayerState {
  // State
  currentRoom: RoomResponse | null;
  rooms: RoomResponse[];
  isConnected: boolean;
  countdown: number | null;
  multiplayerPositions: Map<string, MultiplayerPosition>;
  localSlot: number;
  latency: number;
  isLoading: boolean;
  error: string | null;

  // T1: Match lifecycle state
  multiplayerStartTime: number | null;
  clockOffset: number;
  multiplayerStatus: 'lobby' | 'countdown' | 'racing' | 'finished';
  finishResults: MultiplayerFinishResult[];
  localFinished: boolean;
  disconnectedMessage: string | null;

  // T7: Reconnect state
  reconnectAttempt: number;
  isReconnecting: boolean;

  // Actions
  fetchRooms: () => Promise<void>;
  createRoom: (mapId: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  setReady: () => Promise<void>;
  startMatch: () => Promise<void>;
  connectToMatch: (roomId: string) => void;
  disconnectFromMatch: () => void;
  sendFinish: (finishTimeMs: number) => void;
  sendLeave: () => void;
  sendKick: (targetPlayerId: string) => void;
  updatePosition: (playerId: string, position: Vec3, yaw: number, pitch: number) => void;
  setCountdown: (n: number | null) => void;
  resetMultiplayer: () => void;
  retryReconnect: () => void;
  getTransport: () => IGameTransport | null;
}

let transport: WebSocketTransport | null = null;
let latencyInterval: ReturnType<typeof setInterval> | null = null;

/** Slot-to-playerId mapping, populated by room_snapshot and player_joined events. */
const slotToPlayer = new Map<number, { playerId: string; playerName: string }>();

const LATENCY_POLL_MS = 5000;

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
  currentRoom: null,
  rooms: [],
  isConnected: false,
  countdown: null,
  multiplayerPositions: new Map(),
  localSlot: -1,
  latency: 0,
  isLoading: false,
  error: null,
  multiplayerStartTime: null,
  clockOffset: 0,
  multiplayerStatus: 'lobby',
  finishResults: [],
  localFinished: false,
  disconnectedMessage: null,
  reconnectAttempt: 0,
  isReconnecting: false,

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
      get().connectToMatch(room.id);
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
      get().connectToMatch(room.id);
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

  startMatch: async () => {
    const room = get().currentRoom;
    if (!room) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await apiStartMatch(room.id);
      set({ currentRoom: updated, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to start match',
      });
    }
  },

  connectToMatch: (roomId: string) => {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    slotToPlayer.clear();

    const token = sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    transport = new WebSocketTransport();

    // Binary position batch handler
    let _batchLogTimer = 0;
    transport.onBinary((buffer: ArrayBuffer) => {
      const { count, snapshots } = decodeBatch(buffer);
      const positions = new Map(get().multiplayerPositions);

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

      // Throttled devLog: log at most once per second
      const now = performance.now();
      if (now - _batchLogTimer > 1000) {
        _batchLogTimer = now;
        devLog.info('Net', `pos batch: ${count} players, map size=${positions.size}`);
      }

      set({ multiplayerPositions: positions });
    });

    // ── JSON event handlers ──

    interface RoomSnapshotData {
      roomId: string;
      players: Array<{ playerId: string; name: string; slot: number }>;
      yourSlot: number;
      // T7: enriched rejoin fields (optional — not present on initial connect)
      status?: string;
      multiplayerStartTime?: number;
      positions?: Array<{ slot: number; posX: number; posY: number; posZ: number; yaw: number; pitch: number; speed: number; checkpoint: number }>;
      finishResults?: MultiplayerFinishResult[];
    }

    transport.onJson<RoomSnapshotData>(
      'room_snapshot',
      (data) => {
        slotToPlayer.clear();
        for (const p of data.players) {
          slotToPlayer.set(p.slot, { playerId: p.playerId, playerName: p.name });
        }
        set({ localSlot: data.yourSlot });

        // T7: restore state from enriched rejoin snapshot
        if (data.status) {
          const statusMap: Record<string, MultiplayerState['multiplayerStatus']> = {
            waiting: 'lobby', countdown: 'countdown', racing: 'racing', finished: 'finished',
          };
          const multiplayerStatus = statusMap[data.status] ?? 'lobby';
          set({ multiplayerStatus });

          if (data.multiplayerStartTime) {
            set({ multiplayerStartTime: data.multiplayerStartTime });
          }

          if (data.finishResults) {
            set({ finishResults: data.finishResults });
          }

          // Restore positions from snapshot
          if (data.positions && data.positions.length > 0) {
            const positions = new Map(get().multiplayerPositions);
            for (const pos of data.positions) {
              const playerInfo = slotToPlayer.get(pos.slot);
              if (!playerInfo) continue;
              positions.set(playerInfo.playerId, {
                position: [pos.posX, pos.posY, pos.posZ],
                yaw: pos.yaw / 10000,
                pitch: pos.pitch / 10000,
                speed: pos.speed / 10,
                checkpoint: pos.checkpoint,
                timestamp: 0,
              });
            }
            set({ multiplayerPositions: positions });
          }
        }
      },
    );

    transport.onJson<{ playerId: string; playerName: string; slot: number }>(
      'player_joined',
      (data) => {
        slotToPlayer.set(data.slot, { playerId: data.playerId, playerName: data.playerName });
        const room = get().currentRoom;
        if (room) {
          const alreadyExists = room.participants.some((p) => p.playerId === data.playerId);
          if (!alreadyExists) {
            set({
              currentRoom: {
                ...room,
                participants: [...room.participants, {
                  playerId: data.playerId,
                  playerName: data.playerName,
                  isReady: false,
                  finishTime: null,
                }],
                currentPlayers: room.currentPlayers + 1,
              },
            });
          }
        }
      },
    );

    transport.onJson<{ playerId: string; playerName: string; slot: number }>(
      'player_left',
      (data) => {
        slotToPlayer.delete(data.slot);
        const positions = new Map(get().multiplayerPositions);
        positions.delete(data.playerId);
        const room = get().currentRoom;
        if (room) {
          set({
            multiplayerPositions: positions,
            currentRoom: {
              ...room,
              participants: room.participants.filter((p) => p.playerId !== data.playerId),
              currentPlayers: Math.max(0, room.currentPlayers - 1),
            },
          });
        } else {
          set({ multiplayerPositions: positions });
        }
      },
    );

    transport.onJson<{ countdown: number }>('countdown', (data) => {
      set({ countdown: data.countdown, multiplayerStatus: 'countdown' });
    });

    // T1: match_start — server sends multiplayerStartTime (epoch ms)
    transport.onJson<{ matchStartTime: number }>('match_start', (data) => {
      set({
        multiplayerStartTime: data.matchStartTime,
        multiplayerStatus: 'racing',
        countdown: null,
        localFinished: false,
        finishResults: [],
      });
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: 'racing' } });

        // Transition to game screen — load the multiplayer map
        // mapId from server is a GUID; OFFICIAL_MAP_BY_ID keys by slug, so try both
        const official = OFFICIAL_MAP_BY_ID[room.mapId]
          ?? OFFICIAL_MAPS.find((m) => m.name === room.mapName);
        if (official) {
          useGameStore.getState().loadMap(room.mapId, official.data);
        } else {
          getMap(room.mapId).then((resp) => {
            try {
              const mapData = JSON.parse(resp.mapDataJson) as MapData;
              useGameStore.getState().loadMap(room.mapId, mapData);
            } catch { /* map parse failed */ }
          }).catch(() => { /* fetch failed */ });
        }
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

    // T1: match_finished — all done or timeout
    transport.onJson<{ results: MultiplayerFinishResult[] }>('match_finished', (data) => {
      set({
        multiplayerStatus: 'finished',
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
      const positions = new Map(get().multiplayerPositions);
      positions.delete(data.playerId);
      const room = get().currentRoom;
      if (room) {
        set({
          multiplayerPositions: positions,
          currentRoom: {
            ...room,
            participants: room.participants.filter((p) => p.playerId !== data.playerId),
            currentPlayers: Math.max(0, room.currentPlayers - 1),
          },
        });
      } else {
        set({ multiplayerPositions: positions });
      }
    });

    // T1: room_closed — server killed the room
    transport.onJson<{ reason: string }>('room_closed', (data) => {
      set({ disconnectedMessage: data.reason });
    });

    transport.onJson<{ room: RoomResponse }>('room_update', (data) => {
      set({ currentRoom: data.room });
    });

    transport.onJson<{ roomId: string }>('match_starting', () => {
      const room = get().currentRoom;
      if (room) {
        set({ currentRoom: { ...room, status: 'countdown' }, multiplayerStatus: 'countdown' });
      }
    });

    transport.onOpen(() => {
      set({ isConnected: true, disconnectedMessage: null, reconnectAttempt: 0, isReconnecting: false });
    });

    transport.onClose((_code, reason) => {
      set({ isConnected: false });
      if (!get().disconnectedMessage && reason) {
        set({ disconnectedMessage: reason || 'Connection lost' });
      }
    });

    // T7: Reconnect — send rejoin to get full snapshot after auto-reconnect
    transport.onReconnect(() => {
      set({ isReconnecting: false, reconnectAttempt: 0 });
      transport?.sendJson('rejoin', { lastTimestamp: 0 } as Record<string, unknown>);
    });

    // T7: Track reconnect attempts for UI
    transport.onReconnectAttempt((attempt, maxAttempts) => {
      set({ reconnectAttempt: attempt, isReconnecting: attempt < maxAttempts });
    });

    // T7: Latency polling — read transport.latencyMs every 5s
    if (latencyInterval) clearInterval(latencyInterval);
    latencyInterval = setInterval(() => {
      if (transport) set({ latency: transport.latencyMs });
    }, LATENCY_POLL_MS);

    // Connect
    const wsUrl = buildWsUrl(`/ws/multiplayer/${roomId}`);
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

  disconnectFromMatch: () => {
    if (latencyInterval) { clearInterval(latencyInterval); latencyInterval = null; }
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    slotToPlayer.clear();
    set({
      isConnected: false,
      currentRoom: null,
      countdown: null,
      multiplayerPositions: new Map(),
      localSlot: -1,
      latency: 0,
      multiplayerStartTime: null,
      clockOffset: 0,
      multiplayerStatus: 'lobby',
      finishResults: [],
      localFinished: false,
      disconnectedMessage: null,
      reconnectAttempt: 0,
      isReconnecting: false,
    });
  },

  updatePosition: (playerId: string, position: Vec3, yaw: number, pitch: number) => {
    const positions = new Map(get().multiplayerPositions);
    positions.set(playerId, { position, yaw, pitch, speed: 0, checkpoint: 0, timestamp: 0 });
    set({ multiplayerPositions: positions });
  },

  setCountdown: (n: number | null) => {
    set({ countdown: n });
  },

  resetMultiplayer: () => {
    if (latencyInterval) { clearInterval(latencyInterval); latencyInterval = null; }
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
      multiplayerPositions: new Map(),
      localSlot: -1,
      latency: 0,
      isLoading: false,
      error: null,
      multiplayerStartTime: null,
      clockOffset: 0,
      multiplayerStatus: 'lobby',
      finishResults: [],
      localFinished: false,
      disconnectedMessage: null,
      reconnectAttempt: 0,
      isReconnecting: false,
    });
  },

  retryReconnect: () => {
    if (transport) {
      transport.resetReconnect();
      set({ reconnectAttempt: 0, isReconnecting: true, disconnectedMessage: null });
    }
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
