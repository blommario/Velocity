import { create } from 'zustand';
import { api, STORAGE_KEYS } from '@game/services/api';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@game/services/types';

interface AuthState {
  token: string | null;
  playerId: string | null;
  username: string | null;
  isLoading: boolean;
  error: string | null;

  login: (req: LoginRequest) => Promise<void>;
  register: (req: RegisterRequest) => Promise<void>;
  guestLogin: () => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  playerId: null,
  username: null,
  isLoading: false,
  error: null,

  login: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<AuthResponse>('/auth/login', req);
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.token);
      set({ token: res.token, playerId: res.playerId, username: res.username, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Login failed' });
    }
  },

  register: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<AuthResponse>('/auth/register', req);
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.token);
      set({ token: res.token, playerId: res.playerId, username: res.username, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Registration failed' });
    }
  },

  guestLogin: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<AuthResponse>('/auth/guest');
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.token);
      set({ token: res.token, playerId: res.playerId, username: res.username, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Guest login failed' });
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    set({ token: null, playerId: null, username: null, error: null });
  },

  restoreSession: () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    // Decode JWT payload to extract claims (no verification — backend validates)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      if (Date.now() >= exp) {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        return;
      }
      const playerId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
      const username = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
      set({ token, playerId, username });
    } catch {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  },
}));
