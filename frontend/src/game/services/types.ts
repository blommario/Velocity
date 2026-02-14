/**
 * Shared API request/response type definitions for all service modules.
 * Mirrors backend Contracts/ DTOs with camelCase naming.
 *
 * Depends on: none
 * Used by: api, leaderboardService, mapService, multiplayerService, replayService, runService, authStore, multiplayerStore
 */
// ── Auth ──
export interface AuthResponse {
  token: string;
  playerId: string;
  username: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// ── Maps ──
export type MapDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface MapResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  authorName: string;
  difficulty: MapDifficulty;
  isOfficial: boolean;
  playCount: number;
  likeCount: number;
  worldRecordTime: number | null;
  mapDataJson: string;
  createdAt: string;
}

// ── Runs ──
export interface SubmitRunRequest {
  mapId: string;
  time: number;
  maxSpeed: number;
  averageSpeed: number;
  jumpCount: number;
  rocketJumps: number;
}

export interface RunResponse {
  id: string;
  mapId: string;
  playerId: string;
  playerName: string;
  time: number;
  maxSpeed: number;
  averageSpeed: number;
  jumpCount: number;
  rocketJumps: number;
  completedAt: string;
  isPersonalBest: boolean;
}

// ── Leaderboard ──
export interface LeaderboardEntryResponse {
  rank: number;
  runId: string;
  playerId: string;
  playerName: string;
  time: number;
  maxSpeed: number;
  averageSpeed: number;
  jumpCount: number;
  achievedAt: string;
}

export interface LeaderboardResponse {
  mapId: string;
  entries: LeaderboardEntryResponse[];
}

// ── Replays ──
export interface SubmitReplayRequest {
  replayDataJson: string;
}

export interface ReplayResponse {
  runId: string;
  replayDataJson: string;
}

// ── Player ──
export interface PlayerProfileResponse {
  id: string;
  username: string;
  isGuest: boolean;
  createdAt: string;
  totalRuns: number;
  mapsCreated: number;
  leaderboardEntries: number;
}

export interface PlayerRecentRunResponse {
  runId: string;
  mapId: string;
  mapName: string;
  time: number;
  maxSpeed: number;
  completedAt: string;
  isPersonalBest: boolean;
}

export interface PlayerProfileDetailResponse {
  profile: PlayerProfileResponse;
  recentRuns: PlayerRecentRunResponse[];
}

// ── Multiplayer Rooms ──
export interface ParticipantResponse {
  playerId: string;
  playerName: string;
  isReady: boolean;
  finishTime: number | null;
}

export interface RoomResponse {
  id: string;
  mapId: string;
  mapName: string;
  hostPlayerId: string;
  hostName: string;
  status: string;
  maxPlayers: number;
  currentPlayers: number;
  createdAt: string;
  participants: ParticipantResponse[];
}

export interface CreateRoomRequest {
  mapId: string;
}

export type RoomStatus = 'waiting' | 'countdown' | 'ingame' | 'finished';

// ── Multiplayer SSE Events ──
export interface MultiplayerCountdownEvent {
  countdown: number;
}

export interface MultiplayerPositionEvent {
  playerId: string;
  playerName: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

export interface MultiplayerPlayerFinishedEvent {
  playerId: string;
  playerName: string;
  finishTime: number;
}

export interface MultiplayerRoomUpdateEvent {
  room: RoomResponse;
}

export interface MultiplayerEventMap {
  countdown: MultiplayerCountdownEvent;
  position: MultiplayerPositionEvent;
  playerFinished: MultiplayerPlayerFinishedEvent;
  roomUpdate: MultiplayerRoomUpdateEvent;
  message: MultiplayerRoomUpdateEvent;
}
