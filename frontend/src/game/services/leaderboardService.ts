/**
 * Leaderboard API service — fetches ranked entries for a given map.
 *
 * Depends on: ./api, ./types
 * Used by: MainMenu, GameCanvas (post-run)
 */
import { api } from './api';
import type { LeaderboardResponse } from './types';

export async function getLeaderboard(mapId: string): Promise<LeaderboardResponse> {
  return api.get<LeaderboardResponse>(`/maps/${mapId}/leaderboard`);
}
