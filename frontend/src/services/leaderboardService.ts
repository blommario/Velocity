import { api } from './api';
import type { LeaderboardResponse } from './types';

export async function getLeaderboard(mapId: string): Promise<LeaderboardResponse> {
  return api.get<LeaderboardResponse>(`/maps/${mapId}/leaderboard`);
}
