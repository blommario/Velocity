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
