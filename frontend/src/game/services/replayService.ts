/**
 * Replay API service — submitting and retrieving run replay data.
 *
 * Depends on: ./api, ./types
 * Used by: replayStore, GameCanvas (post-run)
 */
import { api } from './api';
import type { ReplayResponse } from './types';

export async function submitReplay(runId: string, replayDataJson: string): Promise<void> {
  await api.post(`/runs/${runId}/replay`, { replayDataJson });
}

export async function getReplay(runId: string): Promise<ReplayResponse> {
  return api.get<ReplayResponse>(`/runs/${runId}/replay`);
}
