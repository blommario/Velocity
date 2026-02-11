/**
 * Shared API request/response type definitions for all service modules.
 * Mirrors backend Contracts/ DTOs with camelCase naming.
 *
 * Depends on: none
 * Used by: api, leaderboardService, mapService, raceService, replayService, runService, authStore, raceStore
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

// ── Race Rooms ──
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

export type RoomStatus = 'waiting' | 'countdown' | 'racing' | 'finished';

// ── Race SSE Events ──
export interface RaceCountdownEvent {
  countdown: number;
}

export interface RacePositionEvent {
  playerId: string;
  playerName: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

export interface RacePlayerFinishedEvent {
  playerId: string;
  playerName: string;
  finishTime: number;
}

export interface RaceRoomUpdateEvent {
  room: RoomResponse;
}

export interface RaceEventMap {
  countdown: RaceCountdownEvent;
  position: RacePositionEvent;
  playerFinished: RacePlayerFinishedEvent;
  roomUpdate: RaceRoomUpdateEvent;
  message: RaceRoomUpdateEvent;
}
