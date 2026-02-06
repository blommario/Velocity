import { create } from 'zustand';

export const SCREENS = {
  MAIN_MENU: 'mainMenu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  MAP_EDITOR: 'mapEditor',
  SETTINGS: 'settings',
} as const;

export type Screen = (typeof SCREENS)[keyof typeof SCREENS];

interface GameState {
  screen: Screen;
  speed: number;
  position: [number, number, number];
  isGrounded: boolean;

  timerRunning: boolean;
  startTime: number;
  elapsedMs: number;

  setScreen: (screen: Screen) => void;
  setSpeed: (speed: number) => void;
  setPosition: (pos: [number, number, number]) => void;
  setGrounded: (grounded: boolean) => void;
  updateHud: (speed: number, position: [number, number, number], isGrounded: boolean) => void;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: SCREENS.PLAYING,
  speed: 0,
  position: [0, 0, 0],
  isGrounded: false,

  timerRunning: false,
  startTime: 0,
  elapsedMs: 0,

  setScreen: (screen) => set({ screen }),
  setSpeed: (speed) => set({ speed }),
  setPosition: (position) => set({ position }),
  setGrounded: (isGrounded) => set({ isGrounded }),
  updateHud: (speed, position, isGrounded) => set({ speed, position, isGrounded }),

  startTimer: () => set({ timerRunning: true, startTime: performance.now(), elapsedMs: 0 }),
  stopTimer: () => {
    const state = get();
    set({
      timerRunning: false,
      elapsedMs: state.timerRunning ? performance.now() - state.startTime : state.elapsedMs,
    });
  },
  resetTimer: () => set({ elapsedMs: 0, timerRunning: false, startTime: 0 }),
  tickTimer: () => {
    const state = get();
    if (state.timerRunning) {
      set({ elapsedMs: performance.now() - state.startTime });
    }
  },
}));
