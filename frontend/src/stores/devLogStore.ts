import { create } from 'zustand';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
}

const MAX_ENTRIES = 150;

interface DevLogState {
  entries: LogEntry[];
  nextId: number;
  visible: boolean;
  push: (level: LogLevel, source: string, message: string) => void;
  toggle: () => void;
  clear: () => void;
}

export const useDevLogStore = create<DevLogState>((set) => ({
  entries: [],
  nextId: 1,
  visible: true,

  push: (level, source, message) => set((s) => {
    const entry: LogEntry = {
      id: s.nextId,
      timestamp: performance.now(),
      level,
      source,
      message,
    };
    const entries = [...s.entries, entry].slice(-MAX_ENTRIES);
    return { entries, nextId: s.nextId + 1 };
  }),

  toggle: () => set((s) => ({ visible: !s.visible })),
  clear: () => set({ entries: [], nextId: 1 }),
}));

// Convenience functions for use anywhere without hooks
export const devLog = {
  info: (source: string, message: string) => useDevLogStore.getState().push('info', source, message),
  success: (source: string, message: string) => useDevLogStore.getState().push('success', source, message),
  warn: (source: string, message: string) => useDevLogStore.getState().push('warn', source, message),
  error: (source: string, message: string) => useDevLogStore.getState().push('error', source, message),
};
