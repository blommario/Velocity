/**
 * Map API service — listing, fetching, and liking community maps.
 *
 * Depends on: ./api, ./types
 * Used by: MainMenu, MapEditor
 */
import { api } from './api';
import type { MapResponse, MapDifficulty } from './types';

interface MapListParams {
  page?: number;
  pageSize?: number;
  isOfficial?: boolean;
  difficulty?: MapDifficulty;
}

export async function getMaps(params: MapListParams = {}): Promise<MapResponse[]> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.isOfficial !== undefined) query.set('isOfficial', String(params.isOfficial));
  if (params.difficulty !== undefined) query.set('difficulty', params.difficulty);

  const qs = query.toString();
  return api.get<MapResponse[]>(`/maps${qs ? `?${qs}` : ''}`);
}

export async function getMap(id: string): Promise<MapResponse> {
  return api.get<MapResponse>(`/maps/${id}`);
}

export async function likeMap(id: string): Promise<{ likeCount: number }> {
  return api.post<{ likeCount: number }>(`/maps/${id}/like`);
}
