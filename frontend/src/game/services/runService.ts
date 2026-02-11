/**
 * Run API service — submitting completed runs and fetching player run history.
 *
 * Depends on: ./api, ./types
 * Used by: GameCanvas (post-run), PlayerProfile
 */
import { api } from './api';
import type { RunResponse, SubmitRunRequest } from './types';

export async function submitRun(request: SubmitRunRequest): Promise<RunResponse> {
  return api.post<RunResponse>('/runs', request);
}

export async function getRun(id: string): Promise<RunResponse> {
  return api.get<RunResponse>(`/runs/${id}`);
}

export async function getPlayerRuns(mapId: string): Promise<RunResponse[]> {
  return api.get<RunResponse[]>(`/runs/map/${mapId}`);
}
