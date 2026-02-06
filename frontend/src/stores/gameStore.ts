import { create } from 'zustand';

export const SCREENS = {
  MAIN_MENU: 'mainMenu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  MAP_EDITOR: 'mapEditor',
  SETTINGS: 'settings',
} as const;

export type Screen = (typeof SCREENS)[keyof typeof SCREENS];

export const RUN_STATES = {
  READY: 'ready',
  RUNNING: 'running',
  FINISHED: 'finished',
} as const;

export type RunState = (typeof RUN_STATES)[keyof typeof RUN_STATES];

export interface SplitTime {
  checkpointIndex: number;
  time: number;
}

export interface RunStats {
  maxSpeed: number;
  totalDistance: number;
  totalJumps: number;
  averageSpeed: number;
}

const KILL_ZONE_Y = -50;
const INITIAL_STATS: RunStats = {
  maxSpeed: 0,
  totalDistance: 0,
  totalJumps: 0,
  averageSpeed: 0,
};

interface GameState {
  screen: Screen;
  speed: number;
  position: [number, number, number];
  isGrounded: boolean;

  // Run state machine
  runState: RunState;
  timerRunning: boolean;
  startTime: number;
  elapsedMs: number;

  // Checkpoints
  totalCheckpoints: number;
  currentCheckpoint: number;
  splitTimes: SplitTime[];

  // Spawn / respawn
  spawnPoint: [number, number, number];
  spawnYaw: number;
  lastCheckpointPos: [number, number, number];
  lastCheckpointYaw: number;
  respawnRequested: boolean;

  // Run stats
  stats: RunStats;
  previousPosition: [number, number, number];
  speedSamples: number;
  speedSum: number;

  // Actions
  setScreen: (screen: Screen) => void;
  updateHud: (speed: number, position: [number, number, number], isGrounded: boolean) => void;

  // Run lifecycle
  initRun: (totalCheckpoints: number, spawnPoint: [number, number, number], spawnYaw: number) => void;
  startRun: () => void;
  hitCheckpoint: (index: number) => void;
  finishRun: () => void;
  resetRun: () => void;
  tickTimer: () => void;

  // Respawn
  requestRespawn: () => void;
  consumeRespawn: () => { pos: [number, number, number]; yaw: number } | null;
  checkKillZone: () => boolean;

  // Stats
  recordJump: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: SCREENS.PLAYING,
  speed: 0,
  position: [0, 0, 0],
  isGrounded: false,

  runState: RUN_STATES.READY,
  timerRunning: false,
  startTime: 0,
  elapsedMs: 0,

  totalCheckpoints: 0,
  currentCheckpoint: 0,
  splitTimes: [],

  spawnPoint: [0, 3, 0],
  spawnYaw: 0,
  lastCheckpointPos: [0, 3, 0],
  lastCheckpointYaw: 0,
  respawnRequested: false,

  stats: { ...INITIAL_STATS },
  previousPosition: [0, 0, 0],
  speedSamples: 0,
  speedSum: 0,

  setScreen: (screen) => set({ screen }),

  updateHud: (speed, position, isGrounded) => {
    const state = get();
    // Track distance
    const dx = position[0] - state.previousPosition[0];
    const dz = position[2] - state.previousPosition[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    const newMaxSpeed = speed > state.stats.maxSpeed ? speed : state.stats.maxSpeed;
    const newSamples = state.speedSamples + 1;
    const newSum = state.speedSum + speed;

    set({
      speed,
      position,
      isGrounded,
      previousPosition: position,
      speedSamples: newSamples,
      speedSum: newSum,
      stats: {
        ...state.stats,
        maxSpeed: newMaxSpeed,
        totalDistance: state.stats.totalDistance + dist,
        averageSpeed: newSum / newSamples,
      },
    });
  },

  initRun: (totalCheckpoints, spawnPoint, spawnYaw) =>
    set({
      runState: RUN_STATES.READY,
      timerRunning: false,
      startTime: 0,
      elapsedMs: 0,
      totalCheckpoints,
      currentCheckpoint: 0,
      splitTimes: [],
      spawnPoint,
      spawnYaw,
      lastCheckpointPos: spawnPoint,
      lastCheckpointYaw: spawnYaw,
      respawnRequested: false,
      stats: { ...INITIAL_STATS },
      speedSamples: 0,
      speedSum: 0,
    }),

  startRun: () => {
    const state = get();
    if (state.runState !== RUN_STATES.READY) return;
    set({
      runState: RUN_STATES.RUNNING,
      timerRunning: true,
      startTime: performance.now(),
      elapsedMs: 0,
      stats: { ...INITIAL_STATS },
      speedSamples: 0,
      speedSum: 0,
    });
  },

  hitCheckpoint: (index) => {
    const state = get();
    if (state.runState !== RUN_STATES.RUNNING) return;
    if (index !== state.currentCheckpoint) return;

    const time = performance.now() - state.startTime;
    set({
      currentCheckpoint: state.currentCheckpoint + 1,
      splitTimes: [...state.splitTimes, { checkpointIndex: index, time }],
      lastCheckpointPos: state.position,
      lastCheckpointYaw: 0,
    });
  },

  finishRun: () => {
    const state = get();
    if (state.runState !== RUN_STATES.RUNNING) return;
    set({
      runState: RUN_STATES.FINISHED,
      timerRunning: false,
      elapsedMs: performance.now() - state.startTime,
    });
  },

  resetRun: () => {
    const state = get();
    set({
      runState: RUN_STATES.READY,
      timerRunning: false,
      startTime: 0,
      elapsedMs: 0,
      currentCheckpoint: 0,
      splitTimes: [],
      lastCheckpointPos: state.spawnPoint,
      lastCheckpointYaw: state.spawnYaw,
      respawnRequested: true,
      stats: { ...INITIAL_STATS },
      speedSamples: 0,
      speedSum: 0,
    });
  },

  tickTimer: () => {
    const state = get();
    if (state.timerRunning) {
      set({ elapsedMs: performance.now() - state.startTime });
    }
  },

  requestRespawn: () => set({ respawnRequested: true }),

  consumeRespawn: () => {
    const state = get();
    if (!state.respawnRequested) return null;
    set({ respawnRequested: false });
    return { pos: state.lastCheckpointPos, yaw: state.lastCheckpointYaw };
  },

  checkKillZone: () => {
    const state = get();
    return state.position[1] < KILL_ZONE_Y;
  },

  recordJump: () => {
    const state = get();
    set({
      stats: { ...state.stats, totalJumps: state.stats.totalJumps + 1 },
    });
  },
}));
