import { create } from 'zustand';

/** A single replay frame recorded at 128Hz */
export interface ReplayFrame {
  /** Time offset from run start in ms */
  t: number;
  /** Position [x, y, z] */
  p: [number, number, number];
  /** Rotation [yaw, pitch] */
  r: [number, number];
}

/** Compressed replay data for storage/transmission */
export interface ReplayData {
  /** Frames per second used during recording */
  tickRate: number;
  /** Total run time in ms */
  totalTime: number;
  /** Keyframes at full precision (every Nth frame) */
  keyframes: ReplayFrame[];
  /** Delta frames between keyframes (offsets from previous frame) */
  deltas: DeltaFrame[];
}

/** Delta-compressed frame — stores only differences from previous frame */
export interface DeltaFrame {
  /** Time delta from previous frame in ms (uint16) */
  dt: number;
  /** Position delta [dx, dy, dz] (float16 precision) */
  dp: [number, number, number];
  /** Rotation delta [dYaw, dPitch] */
  dr: [number, number];
}

const KEYFRAME_INTERVAL = 32; // keyframe every 32 frames (~250ms at 128Hz)
const DOWNSAMPLE_HZ = 30;    // ghost playback at 30Hz (interpolated)
const DOWNSAMPLE_RATIO = Math.round(128 / DOWNSAMPLE_HZ); // ~4 frames

interface ReplayState {
  // Recording
  isRecording: boolean;
  frames: ReplayFrame[];
  recordStartTime: number;

  // Playback
  currentReplay: ReplayData | null;
  ghostReplay: ReplayData | null; // PB or WR ghost
  isPlaying: boolean;
  playbackTime: number;

  // Actions
  startRecording: () => void;
  recordFrame: (position: [number, number, number], yaw: number, pitch: number) => void;
  stopRecording: () => ReplayData | null;

  // Playback
  loadGhost: (replay: ReplayData) => void;
  clearGhost: () => void;
  getGhostPosition: (timeMs: number) => { position: [number, number, number]; yaw: number; pitch: number } | null;

  // Reset
  resetReplay: () => void;
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  isRecording: false,
  frames: [],
  recordStartTime: 0,

  currentReplay: null,
  ghostReplay: null,
  isPlaying: false,
  playbackTime: 0,

  startRecording: () => set({
    isRecording: true,
    frames: [],
    recordStartTime: performance.now(),
  }),

  recordFrame: (position, yaw, pitch) => {
    const state = get();
    if (!state.isRecording) return;

    const t = performance.now() - state.recordStartTime;

    // Downsample: only record every Nth frame to keep data manageable
    const frameCount = state.frames.length;
    if (frameCount > 0) {
      const lastFrame = state.frames[frameCount - 1];
      if (t - lastFrame.t < (1000 / DOWNSAMPLE_HZ) * 0.9) return;
    }

    state.frames.push({
      t,
      p: [
        Math.round(position[0] * 100) / 100,
        Math.round(position[1] * 100) / 100,
        Math.round(position[2] * 100) / 100,
      ],
      r: [
        Math.round(yaw * 1000) / 1000,
        Math.round(pitch * 1000) / 1000,
      ],
    });
  },

  stopRecording: () => {
    const state = get();
    if (!state.isRecording || state.frames.length < 2) {
      set({ isRecording: false, frames: [] });
      return null;
    }

    const replay = compressReplay(state.frames);
    set({
      isRecording: false,
      currentReplay: replay,
      frames: [],
    });
    return replay;
  },

  loadGhost: (replay) => set({ ghostReplay: replay }),
  clearGhost: () => set({ ghostReplay: null }),

  getGhostPosition: (timeMs) => {
    const state = get();
    const replay = state.ghostReplay;
    if (!replay) return null;

    return interpolateReplay(replay, timeMs);
  },

  resetReplay: () => set({
    isRecording: false,
    frames: [],
    recordStartTime: 0,
    currentReplay: null,
    isPlaying: false,
    playbackTime: 0,
  }),
}));

// ── Compression ──

function compressReplay(frames: ReplayFrame[]): ReplayData {
  const keyframes: ReplayFrame[] = [];
  const deltas: DeltaFrame[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (i % KEYFRAME_INTERVAL === 0) {
      keyframes.push(frames[i]);
    } else {
      const prev = frames[i - 1];
      const curr = frames[i];
      deltas.push({
        dt: Math.round(curr.t - prev.t),
        dp: [
          Math.round((curr.p[0] - prev.p[0]) * 100) / 100,
          Math.round((curr.p[1] - prev.p[1]) * 100) / 100,
          Math.round((curr.p[2] - prev.p[2]) * 100) / 100,
        ],
        dr: [
          Math.round((curr.r[0] - prev.r[0]) * 1000) / 1000,
          Math.round((curr.r[1] - prev.r[1]) * 1000) / 1000,
        ],
      });
    }
  }

  return {
    tickRate: DOWNSAMPLE_HZ,
    totalTime: frames[frames.length - 1].t,
    keyframes,
    deltas,
  };
}

// ── Decompression & Interpolation ──

function decompressReplay(replay: ReplayData): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  let keyIndex = 0;
  let deltaIndex = 0;

  while (keyIndex < replay.keyframes.length) {
    const kf = replay.keyframes[keyIndex];
    frames.push(kf);
    keyIndex++;

    // Add delta frames until next keyframe
    let prev = kf;
    for (let i = 0; i < KEYFRAME_INTERVAL - 1 && deltaIndex < replay.deltas.length; i++) {
      const d = replay.deltas[deltaIndex];
      const frame: ReplayFrame = {
        t: prev.t + d.dt,
        p: [prev.p[0] + d.dp[0], prev.p[1] + d.dp[1], prev.p[2] + d.dp[2]],
        r: [prev.r[0] + d.dr[0], prev.r[1] + d.dr[1]],
      };
      frames.push(frame);
      prev = frame;
      deltaIndex++;

      // Stop if next frame would be a keyframe
      if ((frames.length) % KEYFRAME_INTERVAL === 0) break;
    }
  }

  return frames;
}

/** Cache decompressed frames per replay instance */
const decompressCache = new WeakMap<ReplayData, ReplayFrame[]>();

function getDecompressedFrames(replay: ReplayData): ReplayFrame[] {
  let cached = decompressCache.get(replay);
  if (!cached) {
    cached = decompressReplay(replay);
    decompressCache.set(replay, cached);
  }
  return cached;
}

function interpolateReplay(
  replay: ReplayData,
  timeMs: number,
): { position: [number, number, number]; yaw: number; pitch: number } | null {
  const frames = getDecompressedFrames(replay);
  if (frames.length === 0) return null;

  if (timeMs <= frames[0].t) {
    return { position: frames[0].p, yaw: frames[0].r[0], pitch: frames[0].r[1] };
  }

  if (timeMs >= frames[frames.length - 1].t) {
    const last = frames[frames.length - 1];
    return { position: last.p, yaw: last.r[0], pitch: last.r[1] };
  }

  // Binary search for the right interval
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= timeMs) lo = mid;
    else hi = mid;
  }

  const a = frames[lo];
  const b = frames[hi];
  const t = (timeMs - a.t) / (b.t - a.t);

  return {
    position: [
      a.p[0] + (b.p[0] - a.p[0]) * t,
      a.p[1] + (b.p[1] - a.p[1]) * t,
      a.p[2] + (b.p[2] - a.p[2]) * t,
    ],
    yaw: a.r[0] + (b.r[0] - a.r[0]) * t,
    pitch: a.r[1] + (b.r[1] - a.r[1]) * t,
  };
}

/** Serialize replay to compact JSON string for backend storage */
export function serializeReplay(replay: ReplayData): string {
  return JSON.stringify(replay);
}

/** Deserialize replay from backend JSON string */
export function deserializeReplay(json: string): ReplayData {
  return JSON.parse(json) as ReplayData;
}
