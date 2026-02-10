/**
 * Zustand store for queuing explosion spawn requests. Decouples spawn
 * triggers (combat, impact) from the GPU particle system that consumes them.
 *
 * Depends on: zustand, explosionConfig
 * Used by: spawnImpactEffects, projectileTick, ExplosionEffect (consumer)
 */
import { create } from 'zustand';
import { EXPLOSION, type ExplosionRequest } from './explosionConfig';

interface ExplosionState {
  requests: ExplosionRequest[];
  nextId: number;
  spawnExplosion: (position: [number, number, number], color: string, scale?: number) => void;
  consumeRequests: () => ExplosionRequest[];
}

export const useExplosionStore = create<ExplosionState>((set, get) => ({
  requests: [],
  nextId: 1,
  spawnExplosion: (position, color, scale = 1) => {
    const current = get().requests;
    if (current.length >= EXPLOSION.MAX_REQUESTS) return;
    set((state) => ({
      nextId: state.nextId + 1,
      requests: [...state.requests, { id: state.nextId, position, color, scale }],
    }));
  },
  consumeRequests: () => {
    const reqs = get().requests;
    if (reqs.length === 0) return [];
    set({ requests: [] });
    return reqs;
  },
}));
