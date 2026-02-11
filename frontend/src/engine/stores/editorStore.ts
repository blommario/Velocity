/**
 * Map editor state — object CRUD, tool selection, undo/redo, serialization.
 *
 * Depends on: zustand, types/map
 * Used by: MapEditor, EditorViewport, ObjectPalette, EditorGizmo
 */
import { create } from 'zustand';
import type {
  MapData, MapBlock, Vec3, CheckpointData, FinishZoneData,
  KillZoneData, BoostPadData, LaunchPadData, SpeedGateData,
  AmmoPickupData, GrapplePointData, SurfRampData, MovingPlatformData,
  MapSettings, AmbientLighting, SkyboxType, Color,
} from '../types/map';

// ── Object types ──

export const EDITOR_OBJECT_TYPES = {
  BLOCK: 'block',
  CHECKPOINT: 'checkpoint',
  FINISH: 'finish',
  KILL_ZONE: 'killZone',
  BOOST_PAD: 'boostPad',
  LAUNCH_PAD: 'launchPad',
  SPEED_GATE: 'speedGate',
  AMMO_PICKUP: 'ammoPickup',
  GRAPPLE_POINT: 'grapplePoint',
  SURF_RAMP: 'surfRamp',
  MOVING_PLATFORM: 'movingPlatform',
} as const;

export type EditorObjectType = (typeof EDITOR_OBJECT_TYPES)[keyof typeof EDITOR_OBJECT_TYPES];

export const EDITOR_TOOLS = {
  SELECT: 'select',
  PLACE: 'place',
  MOVE: 'move',
  ROTATE: 'rotate',
  SCALE: 'scale',
} as const;

export type EditorTool = (typeof EDITOR_TOOLS)[keyof typeof EDITOR_TOOLS];

export const LIGHTING_PRESETS = {
  DAY: 'day',
  SUNSET: 'sunset',
  NIGHT: 'night',
  NEON: 'neon',
} as const;

export type LightingPreset = (typeof LIGHTING_PRESETS)[keyof typeof LIGHTING_PRESETS];

const LIGHTING_PRESET_DATA: Record<LightingPreset, AmbientLighting> = {
  day: {
    ambientIntensity: 0.6,
    ambientColor: '#ffffff',
    directionalIntensity: 1.0,
    directionalColor: '#ffffff',
    directionalPosition: [50, 100, 50],
    hemisphereGround: '#8B7355',
    hemisphereSky: '#87CEEB',
    hemisphereIntensity: 0.3,
    fogColor: '#87CEEB',
    fogNear: 100,
    fogFar: 500,
  },
  sunset: {
    ambientIntensity: 0.4,
    ambientColor: '#FFD4A3',
    directionalIntensity: 0.8,
    directionalColor: '#FF8C42',
    directionalPosition: [100, 30, -50],
    hemisphereGround: '#4A3728',
    hemisphereSky: '#FF6B35',
    hemisphereIntensity: 0.4,
    fogColor: '#FF8C42',
    fogNear: 80,
    fogFar: 400,
  },
  night: {
    ambientIntensity: 0.15,
    ambientColor: '#1a1a3e',
    directionalIntensity: 0.3,
    directionalColor: '#C0C0E0',
    directionalPosition: [50, 80, 50],
    hemisphereGround: '#0a0a20',
    hemisphereSky: '#1a1a3e',
    hemisphereIntensity: 0.2,
    fogColor: '#0a0a20',
    fogNear: 50,
    fogFar: 300,
  },
  neon: {
    ambientIntensity: 0.2,
    ambientColor: '#0f0f2e',
    directionalIntensity: 0.4,
    directionalColor: '#8080FF',
    directionalPosition: [50, 100, 50],
    hemisphereGround: '#0f0f1a',
    hemisphereSky: '#1a0a3e',
    hemisphereIntensity: 0.3,
    fogColor: '#0f0f2e',
    fogNear: 50,
    fogFar: 350,
  },
};

// ── Editor object wrapper (with unique IDs for selection) ──

export interface EditorObject {
  id: string;
  type: EditorObjectType;
  data: MapBlock | CheckpointData | FinishZoneData | KillZoneData
    | BoostPadData | LaunchPadData | SpeedGateData | AmmoPickupData
    | GrapplePointData | SurfRampData | MovingPlatformData;
}

// ── Grid settings ──
const GRID_SIZES = [0.5, 1, 2, 4, 8] as const;
const DEFAULT_GRID_SIZE = 2;

// ── History entry ──
interface HistoryEntry {
  objects: EditorObject[];
  spawnPoint: Vec3;
  spawnDirection: Vec3;
}

const MAX_HISTORY = 50;

let nextId = 1;
function generateId(): string {
  return `obj_${nextId++}`;
}

// ── Default objects ──

function defaultBlock(): MapBlock {
  return {
    shape: 'box',
    position: [0, 0, 0],
    size: [4, 1, 4],
    color: '#808080',
  };
}

function defaultCheckpoint(index: number): CheckpointData {
  return { position: [0, 0, 0], size: [4, 6, 4], index };
}

function defaultFinish(): FinishZoneData {
  return { position: [0, 0, 0], size: [4, 6, 4] };
}

function defaultKillZone(): KillZoneData {
  return { position: [0, -5, 0], size: [100, 1, 100] };
}

function defaultBoostPad(): BoostPadData {
  return { position: [0, 0, 0], direction: [0, 0, -1], speed: 400 };
}

function defaultLaunchPad(): LaunchPadData {
  return { position: [0, 0, 0], direction: [0, 0.7, -0.7], speed: 600 };
}

function defaultSpeedGate(): SpeedGateData {
  return { position: [0, 3, 0], size: [6, 6, 1], multiplier: 1.5, minSpeed: 400 };
}

function defaultAmmoPickup(): AmmoPickupData {
  return { position: [0, 1, 0], weaponType: 'rocket', amount: 3 };
}

function defaultGrapplePoint(): GrapplePointData {
  return { position: [0, 10, 0] };
}

function defaultSurfRamp(): SurfRampData {
  return { position: [0, 0, 0], size: [4, 8, 20], rotation: [0, 0, 0.7], color: '#4488cc' };
}

function defaultMovingPlatform(): MovingPlatformData {
  return { size: [4, 1, 4], waypoints: [[0, 0, 0], [0, 10, 0]], speed: 5, color: '#666666' };
}

const DEFAULT_FACTORIES: Record<EditorObjectType, () => EditorObject['data']> = {
  block: defaultBlock,
  checkpoint: () => defaultCheckpoint(0),
  finish: defaultFinish,
  killZone: defaultKillZone,
  boostPad: defaultBoostPad,
  launchPad: defaultLaunchPad,
  speedGate: defaultSpeedGate,
  ammoPickup: defaultAmmoPickup,
  grapplePoint: defaultGrapplePoint,
  surfRamp: defaultSurfRamp,
  movingPlatform: defaultMovingPlatform,
};

// ── Store ──

interface EditorState {
  // Mode
  isTestPlaying: boolean;

  // Objects
  objects: EditorObject[];
  selectedId: string | null;
  clipboardId: string | null;

  // Map properties
  spawnPoint: Vec3;
  spawnDirection: Vec3;
  settings: MapSettings;
  skybox: SkyboxType;
  lighting: AmbientLighting;
  backgroundColor: Color;

  // Tools
  activeTool: EditorTool;
  placeObjectType: EditorObjectType;
  gridSize: number;
  gridVisible: boolean;
  snapToGrid: boolean;

  // History
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Validation
  validationErrors: string[];

  // Actions — objects
  addObject: (type: EditorObjectType, position?: Vec3) => string;
  removeObject: (id: string) => void;
  updateObject: (id: string, data: Partial<EditorObject['data']>) => void;
  duplicateObject: (id: string) => string | null;
  selectObject: (id: string | null) => void;

  // Actions — tools
  setTool: (tool: EditorTool) => void;
  setPlaceObjectType: (type: EditorObjectType) => void;
  cycleGridSize: () => void;
  toggleGridVisible: () => void;
  toggleSnapToGrid: () => void;

  // Actions — map properties
  setSpawnPoint: (pos: Vec3) => void;
  setSpawnDirection: (dir: Vec3) => void;
  setSettings: (settings: Partial<MapSettings>) => void;
  setSkybox: (skybox: SkyboxType) => void;
  applyLightingPreset: (preset: LightingPreset) => void;
  setBackgroundColor: (color: Color) => void;

  // Actions — history
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Actions — test play
  toggleTestPlay: () => void;

  // Actions — serialization
  exportMapData: () => MapData;
  importMapData: (data: MapData) => void;
  validate: () => string[];
  newMap: () => void;

  // Helpers
  getSelectedObject: () => EditorObject | null;
  getNextCheckpointIndex: () => number;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  isTestPlaying: false,

  objects: [],
  selectedId: null,
  clipboardId: null,

  spawnPoint: [0, 3, 0],
  spawnDirection: [0, 0, -1],
  settings: {},
  skybox: 'day',
  lighting: { ...LIGHTING_PRESET_DATA.day },
  backgroundColor: '#87CEEB',

  activeTool: EDITOR_TOOLS.SELECT,
  placeObjectType: EDITOR_OBJECT_TYPES.BLOCK,
  gridSize: DEFAULT_GRID_SIZE,
  gridVisible: true,
  snapToGrid: true,

  undoStack: [],
  redoStack: [],

  validationErrors: [],

  // ── Object actions ──

  addObject: (type, position) => {
    const state = get();
    state.pushHistory();

    const id = generateId();
    const data = DEFAULT_FACTORIES[type]();

    // Set position if provided
    if (position) {
      if ('position' in data) {
        (data as { position: Vec3 }).position = position;
      }
      if (type === 'movingPlatform') {
        (data as MovingPlatformData).waypoints[0] = position;
      }
    }

    // Auto-set checkpoint index
    if (type === 'checkpoint') {
      (data as CheckpointData).index = state.getNextCheckpointIndex();
    }

    const obj: EditorObject = { id, type, data };

    set({
      objects: [...state.objects, obj],
      selectedId: id,
      redoStack: [],
    });

    return id;
  },

  removeObject: (id) => {
    const state = get();
    state.pushHistory();
    set({
      objects: state.objects.filter((o) => o.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      redoStack: [],
    });
  },

  updateObject: (id, data) => {
    const state = get();
    state.pushHistory();
    set({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, data: { ...o.data, ...data } } : o
      ),
      redoStack: [],
    });
  },

  duplicateObject: (id) => {
    const state = get();
    const obj = state.objects.find((o) => o.id === id);
    if (!obj) return null;

    state.pushHistory();
    const newId = generateId();
    const clonedData = JSON.parse(JSON.stringify(obj.data)) as EditorObject['data'];

    // Offset position slightly
    if ('position' in clonedData) {
      const pos = (clonedData as { position: Vec3 }).position;
      pos[0] += state.gridSize;
    }

    if (obj.type === 'checkpoint') {
      (clonedData as CheckpointData).index = state.getNextCheckpointIndex();
    }

    set({
      objects: [...state.objects, { id: newId, type: obj.type, data: clonedData }],
      selectedId: newId,
      redoStack: [],
    });

    return newId;
  },

  selectObject: (id) => set({ selectedId: id }),

  // ── Tool actions ──

  setTool: (tool) => set({ activeTool: tool }),

  setPlaceObjectType: (type) => set({
    placeObjectType: type,
    activeTool: EDITOR_TOOLS.PLACE,
  }),

  cycleGridSize: () => {
    const state = get();
    const idx = GRID_SIZES.indexOf(state.gridSize as typeof GRID_SIZES[number]);
    const nextIdx = (idx + 1) % GRID_SIZES.length;
    set({ gridSize: GRID_SIZES[nextIdx] });
  },

  toggleGridVisible: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  // ── Map property actions ──

  setSpawnPoint: (pos) => set({ spawnPoint: pos }),
  setSpawnDirection: (dir) => set({ spawnDirection: dir }),

  setSettings: (partial) => {
    const state = get();
    set({ settings: { ...state.settings, ...partial } });
  },

  setSkybox: (skybox) => set({ skybox }),

  applyLightingPreset: (preset) => {
    set({
      lighting: { ...LIGHTING_PRESET_DATA[preset] },
      backgroundColor: LIGHTING_PRESET_DATA[preset].fogColor ?? '#87CEEB',
    });
  },

  setBackgroundColor: (color) => set({ backgroundColor: color }),

  // ── History ──

  pushHistory: () => {
    const state = get();
    const entry: HistoryEntry = {
      objects: JSON.parse(JSON.stringify(state.objects)),
      spawnPoint: [...state.spawnPoint],
      spawnDirection: [...state.spawnDirection],
    };
    const stack = [...state.undoStack, entry].slice(-MAX_HISTORY);
    set({ undoStack: stack });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const current: HistoryEntry = {
      objects: JSON.parse(JSON.stringify(state.objects)),
      spawnPoint: [...state.spawnPoint],
      spawnDirection: [...state.spawnDirection],
    };

    const prev = state.undoStack[state.undoStack.length - 1];
    set({
      objects: prev.objects,
      spawnPoint: prev.spawnPoint,
      spawnDirection: prev.spawnDirection,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, current],
      selectedId: null,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    const current: HistoryEntry = {
      objects: JSON.parse(JSON.stringify(state.objects)),
      spawnPoint: [...state.spawnPoint],
      spawnDirection: [...state.spawnDirection],
    };

    const next = state.redoStack[state.redoStack.length - 1];
    set({
      objects: next.objects,
      spawnPoint: next.spawnPoint,
      spawnDirection: next.spawnDirection,
      undoStack: [...state.undoStack, current],
      redoStack: state.redoStack.slice(0, -1),
      selectedId: null,
    });
  },

  // ── Test play ──

  toggleTestPlay: () => set((s) => ({ isTestPlaying: !s.isTestPlaying })),

  // ── Serialization ──

  exportMapData: () => {
    const state = get();
    const blocks: MapBlock[] = [];
    const checkpoints: CheckpointData[] = [];
    let finish: FinishZoneData = { position: [0, 0, 0], size: [4, 6, 4] };
    const killZones: KillZoneData[] = [];
    const boostPads: BoostPadData[] = [];
    const launchPads: LaunchPadData[] = [];
    const speedGates: SpeedGateData[] = [];
    const ammoPickups: AmmoPickupData[] = [];
    const grapplePoints: GrapplePointData[] = [];
    const surfRamps: SurfRampData[] = [];
    const movingPlatforms: MovingPlatformData[] = [];

    for (const obj of state.objects) {
      switch (obj.type) {
        case 'block': blocks.push(obj.data as MapBlock); break;
        case 'checkpoint': checkpoints.push(obj.data as CheckpointData); break;
        case 'finish': finish = obj.data as FinishZoneData; break;
        case 'killZone': killZones.push(obj.data as KillZoneData); break;
        case 'boostPad': boostPads.push(obj.data as BoostPadData); break;
        case 'launchPad': launchPads.push(obj.data as LaunchPadData); break;
        case 'speedGate': speedGates.push(obj.data as SpeedGateData); break;
        case 'ammoPickup': ammoPickups.push(obj.data as AmmoPickupData); break;
        case 'grapplePoint': grapplePoints.push(obj.data as GrapplePointData); break;
        case 'surfRamp': surfRamps.push(obj.data as SurfRampData); break;
        case 'movingPlatform': movingPlatforms.push(obj.data as MovingPlatformData); break;
      }
    }

    // Sort checkpoints by index
    checkpoints.sort((a, b) => a.index - b.index);

    return {
      spawnPoint: state.spawnPoint,
      spawnDirection: state.spawnDirection,
      blocks,
      checkpoints,
      finish,
      killZones,
      boostPads,
      launchPads,
      speedGates,
      ammoPickups,
      grapplePoints,
      surfRamps,
      movingPlatforms,
      settings: state.settings,
      skybox: state.skybox,
      lighting: state.lighting,
      backgroundColor: state.backgroundColor,
    };
  },

  importMapData: (data) => {
    nextId = 1;
    const objects: EditorObject[] = [];

    for (const b of data.blocks) {
      objects.push({ id: generateId(), type: 'block', data: b });
    }
    for (const c of data.checkpoints) {
      objects.push({ id: generateId(), type: 'checkpoint', data: c });
    }
    if (data.finish) {
      objects.push({ id: generateId(), type: 'finish', data: data.finish });
    }
    for (const k of data.killZones ?? []) {
      objects.push({ id: generateId(), type: 'killZone', data: k });
    }
    for (const b of data.boostPads ?? []) {
      objects.push({ id: generateId(), type: 'boostPad', data: b });
    }
    for (const l of data.launchPads ?? []) {
      objects.push({ id: generateId(), type: 'launchPad', data: l });
    }
    for (const s of data.speedGates ?? []) {
      objects.push({ id: generateId(), type: 'speedGate', data: s });
    }
    for (const a of data.ammoPickups ?? []) {
      objects.push({ id: generateId(), type: 'ammoPickup', data: a });
    }
    for (const g of data.grapplePoints ?? []) {
      objects.push({ id: generateId(), type: 'grapplePoint', data: g });
    }
    for (const s of data.surfRamps ?? []) {
      objects.push({ id: generateId(), type: 'surfRamp', data: s });
    }
    for (const m of data.movingPlatforms ?? []) {
      objects.push({ id: generateId(), type: 'movingPlatform', data: m });
    }

    set({
      objects,
      spawnPoint: data.spawnPoint,
      spawnDirection: data.spawnDirection,
      settings: data.settings ?? {},
      skybox: data.skybox ?? 'day',
      lighting: data.lighting ?? LIGHTING_PRESET_DATA.day,
      backgroundColor: data.backgroundColor ?? '#87CEEB',
      selectedId: null,
      undoStack: [],
      redoStack: [],
      validationErrors: [],
    });
  },

  validate: () => {
    const state = get();
    const errors: string[] = [];

    const hasFinish = state.objects.some((o) => o.type === 'finish');
    if (!hasFinish) errors.push('Map must have a finish zone');

    const checkpoints = state.objects.filter((o) => o.type === 'checkpoint');
    const indices = checkpoints.map((o) => (o.data as CheckpointData).index);
    const sorted = [...indices].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i) {
        errors.push(`Checkpoint indices must be sequential starting from 0 (found gap at index ${i})`);
        break;
      }
    }

    if (state.objects.filter((o) => o.type === 'block').length === 0) {
      errors.push('Map should have at least one block');
    }

    set({ validationErrors: errors });
    return errors;
  },

  newMap: () => {
    nextId = 1;
    set({
      objects: [],
      selectedId: null,
      clipboardId: null,
      spawnPoint: [0, 3, 0],
      spawnDirection: [0, 0, -1],
      settings: {},
      skybox: 'day',
      lighting: { ...LIGHTING_PRESET_DATA.day },
      backgroundColor: '#87CEEB',
      undoStack: [],
      redoStack: [],
      validationErrors: [],
      isTestPlaying: false,
    });
  },

  // ── Helpers ──

  getSelectedObject: () => {
    const state = get();
    if (!state.selectedId) return null;
    return state.objects.find((o) => o.id === state.selectedId) ?? null;
  },

  getNextCheckpointIndex: () => {
    const state = get();
    const checkpoints = state.objects.filter((o) => o.type === 'checkpoint');
    if (checkpoints.length === 0) return 0;
    const maxIndex = Math.max(...checkpoints.map((o) => (o.data as CheckpointData).index));
    return maxIndex + 1;
  },
}));

export { LIGHTING_PRESET_DATA };
