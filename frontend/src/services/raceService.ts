import { api } from './api';
import type {
  RoomResponse,
  CreateRoomRequest,
  PlayerProfileDetailResponse,
} from './types';

export async function createRoom(mapId: string): Promise<RoomResponse> {
  const body: CreateRoomRequest = { mapId };
  return api.post<RoomResponse>('/rooms', body);
}

export async function getActiveRooms(): Promise<RoomResponse[]> {
  return api.get<RoomResponse[]>('/rooms');
}

export async function getRoom(roomId: string): Promise<RoomResponse> {
  return api.get<RoomResponse>(`/rooms/${roomId}`);
}

export async function joinRoom(roomId: string): Promise<RoomResponse> {
  return api.post<RoomResponse>(`/rooms/${roomId}/join`);
}

export async function setReady(roomId: string): Promise<RoomResponse> {
  return api.post<RoomResponse>(`/rooms/${roomId}/ready`);
}

export async function startRace(roomId: string): Promise<RoomResponse> {
  return api.post<RoomResponse>(`/rooms/${roomId}/start`);
}

export async function getPlayerProfile(playerId: string): Promise<PlayerProfileDetailResponse> {
  return api.get<PlayerProfileDetailResponse>(`/players/${playerId}/profile`);
}
