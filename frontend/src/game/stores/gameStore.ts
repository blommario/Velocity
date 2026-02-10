import { create } from 'zustand';
import type { MapData } from '@game/components/game/map/types';
import { useReplayStore } from './replayStore';
import { seedRandom } from '@engine/physics/seededRandom';

export const SCREENS = {
  MAIN_MENU: 'mainMenu',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  MAP_EDITOR: 'mapEditor',
  SETTINGS: 'settings',
  RACE_LOBBY: 'raceLobby',
  PROFILE: 'profile',
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

export interface SplitPopupData {
  checkpointIndex: number;
  time: number;
  delta: number | null; // null = no PB to compare
  timestamp: number;    // performance.now() when shown
}

export type Stance = 'standing' | 'crouching' | 'sliding' | 'prone';

const KILL_ZONE_Y = -50;
const INITIAL_STATS: RunStats = {
  maxSpeed: 0,
  totalDistance: 0,
  totalJumps: 0,
  averageSpeed: 0,
};

interface GameState {
  screen: Screen;
  currentMapId: string | null;
  currentMapData: MapData | null;
  speed: number;
  position: [number, number, number];
  isGrounded: boolean;
  stance: Stance;

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

  // Split popup
  activeSplitPopup: SplitPopupData | null;
  pbSplitTimes: SplitTime[]; // personal best splits for comparison

  // Screen shake
  shakeIntensity: number;

  // Screen effects
  respawnFadeOpacity: number;  // 0 = clear, 1 = black
  deathFlashOpacity: number;   // 0 = clear, 1 = red vignette

  // Loading
  loadProgress: number;        // 0–1
  loadStatus: string;

  // Actions
  setScreen: (screen: Screen) => void;
  loadMap: (mapId: string, mapData: MapData) => void;
  playTestMap: () => void;
  updateHud: (speed: number, position: [number, number, number], isGrounded: boolean, stance?: Stance) => void;

  // Run lifecycle
  initRun: (params: { checkpointCount: number; spawnPoint: [number, number, number]; spawnYaw: number; mapId?: string }) => void;
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

  // Screen shake
  triggerShake: (intensity: number) => void;
  clearShake: () => void;

  // Screen effects
  triggerDeathFlash: () => void;
  triggerRespawnFade: () => void;
  tickScreenEffects: (dt: number) => void;

  // Loading
  setLoadProgress: (progress: number, status: string) => void;
  finishLoading: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: SCREENS.MAIN_MENU,
  currentMapId: null,
  currentMapData: null,
  speed: 0,
  position: [0, 0, 0],
  isGrounded: false,
  stance: 'standing' as Stance,

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

  activeSplitPopup: null,
  pbSplitTimes: [],

  shakeIntensity: 0,
  respawnFadeOpacity: 0,
  deathFlashOpacity: 0,
  loadProgress: 0,
  loadStatus: '',

  setScreen: (screen) => set({ screen }),

  loadMap: (mapId, mapData) => {
    const dir = mapData.spawnDirection;
    const yaw = Math.atan2(-dir[0], -dir[2]);
    set({
      currentMapId: mapId,
      currentMapData: mapData,
      screen: SCREENS.LOADING,
      loadProgress: 0,
      loadStatus: 'Initializing graphics...',
      // Pre-set spawn so PlayerController creates RigidBody at correct position
      spawnPoint: mapData.spawnPoint,
      spawnYaw: yaw,
      lastCheckpointPos: mapData.spawnPoint,
      lastCheckpointYaw: yaw,
      respawnRequested: true,
    });
  },

  playTestMap: () => set({
    currentMapId: null,
    currentMapData: null,
    screen: SCREENS.LOADING,
    loadProgress: 0,
    loadStatus: 'Initializing graphics...',
  }),

  updateHud: (speed, position, isGrounded, stance) => {
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
      stance: stance ?? 'standing',
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

  initRun: ({ checkpointCount, spawnPoint, spawnYaw, mapId }) =>
    set({
      currentMapId: mapId ?? null,
      runState: RUN_STATES.READY,
      timerRunning: false,
      startTime: 0,
      elapsedMs: 0,
      totalCheckpoints: checkpointCount,
      currentCheckpoint: 0,
      splitTimes: [],
      spawnPoint,
      spawnYaw,
      lastCheckpointPos: spawnPoint,
      lastCheckpointYaw: spawnYaw,
      respawnRequested: true,
      stats: { ...INITIAL_STATS },
      speedSamples: 0,
      speedSum: 0,
    }),

  startRun: () => {
    const state = get();
    if (state.runState !== RUN_STATES.READY) return;
    // Seed PRNG deterministically so replays produce identical weapon spread
    seedRandom(state.totalCheckpoints * 7919 + (state.spawnPoint[0] * 31 | 0));
    useReplayStore.getState().startRecording();
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
    const pbSplit = state.pbSplitTimes.find((s) => s.checkpointIndex === index);
    const delta = pbSplit ? time - pbSplit.time : null;

    set({
      currentCheckpoint: state.currentCheckpoint + 1,
      splitTimes: [...state.splitTimes, { checkpointIndex: index, time }],
      lastCheckpointPos: state.position,
      lastCheckpointYaw: 0,
      activeSplitPopup: { checkpointIndex: index, time, delta, timestamp: performance.now() },
    });
  },

  finishRun: () => {
    const state = get();
    if (state.runState !== RUN_STATES.RUNNING) return;
    const finalTime = performance.now() - state.startTime;

    // Stop replay recording and save if PB
    const replay = useReplayStore.getState().stopRecording();

    // Save PB splits if this is a new personal best (or first run)
    const pbFinish = state.pbSplitTimes.length > 0
      ? state.pbSplitTimes[state.pbSplitTimes.length - 1]?.time ?? Infinity
      : Infinity;
    const newSplits = [...state.splitTimes, { checkpointIndex: state.totalCheckpoints, time: finalTime }];
    const isPb = finalTime < pbFinish;

    // Auto-save PB replay as ghost
    if (isPb && replay) {
      useReplayStore.getState().loadGhost(replay);
    }

    set({
      runState: RUN_STATES.FINISHED,
      timerRunning: false,
      elapsedMs: finalTime,
      activeSplitPopup: null,
      pbSplitTimes: isPb ? newSplits : state.pbSplitTimes,
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
      activeSplitPopup: null,
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

  triggerShake: (intensity) => set({ shakeIntensity: Math.min(intensity, 1) }),
  clearShake: () => set({ shakeIntensity: 0 }),

  setLoadProgress: (progress, status) => set({ loadProgress: progress, loadStatus: status }),
  finishLoading: () => set({ screen: SCREENS.PLAYING, loadProgress: 1, loadStatus: 'Ready' }),

  triggerDeathFlash: () => set({ deathFlashOpacity: 1 }),
  triggerRespawnFade: () => set({ respawnFadeOpacity: 1 }),
  tickScreenEffects: (dt) => {
    const s = get();
    const fadeDecay = 3; // fades out over ~0.33s
    const flashDecay = 4; // fades out over ~0.25s
    set({
      respawnFadeOpacity: s.respawnFadeOpacity > 0.01 ? s.respawnFadeOpacity * Math.max(0, 1 - fadeDecay * dt) : 0,
      deathFlashOpacity: s.deathFlashOpacity > 0.01 ? s.deathFlashOpacity * Math.max(0, 1 - flashDecay * dt) : 0,
    });
  },
}));
