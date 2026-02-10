import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SHADOW_QUALITY_LEVELS,
  type ShadowQuality,
} from '../rendering/shadowConfig';

// ── Defaults ──

const DEFAULT_SENSITIVITY = 0.002;

// ── Key Bindings ──

export const DEFAULT_KEY_BINDINGS: Record<string, string> = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  crouch: 'ShiftLeft',
  prone: 'KeyZ',
  fireRocket: 'Mouse0',
  fireGrenade: 'Mouse2',
  grapple: 'KeyE',
  reload: 'KeyR',
  inspect: 'KeyF',
} as const;

export type BindingAction = keyof typeof DEFAULT_KEY_BINDINGS;

// ── Crosshair ──

export const CROSSHAIR_STYLES = {
  DOT: 'dot',
  CROSS: 'cross',
  CIRCLE: 'circle',
  NONE: 'none',
} as const;

export type CrosshairStyle = (typeof CROSSHAIR_STYLES)[keyof typeof CROSSHAIR_STYLES];

// ── Quality Presets ──

export const QUALITY_PRESETS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  ULTRA: 'ultra',
} as const;

export type QualityPreset = (typeof QUALITY_PRESETS)[keyof typeof QUALITY_PRESETS];

// ── Settings State ──

interface SettingsState {
  // Mouse
  sensitivity: number;
  adsSensitivityMult: number;

  // Video
  fov: number;
  qualityPreset: QualityPreset;
  shadowQuality: ShadowQuality;
  bloom: boolean;
  particles: boolean;
  speedLines: boolean;
  screenShake: boolean;

  // Post-Processing
  ssao: boolean;
  colorGrading: boolean;
  filmGrain: boolean;
  chromaticAberration: boolean;
  motionBlur: boolean;
  depthOfField: boolean;

  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  ambientVolume: number;

  // Gameplay
  autoBhop: boolean;
  edgeGrab: boolean;
  crosshairStyle: CrosshairStyle;
  crosshairColor: string;
  crosshairSize: number;

  // HUD
  showSpeedMeter: boolean;
  showTimer: boolean;
  showCheckpoints: boolean;
  showTrackProgress: boolean;
  hudScale: number;
  hudOpacity: number;

  // Camera
  headBob: boolean;
  cameraSmoothing: number;
  viewmodelVisible: boolean;
  viewmodelBob: number;
  fovScaling: boolean;

  // RTS Camera
  rtsPanSpeed: number;
  rtsZoomSpeed: number;
  rtsRotateSpeed: number;
  rtsEdgeScrollEnabled: boolean;

  // Dev Tweaks (session only, not persisted)
  devSpeedMultiplier: number;
  devGravityMultiplier: number;

  // Key Bindings
  keyBindings: Record<string, string>;

  // Actions
  setDevSpeedMultiplier: (v: number) => void;
  setDevGravityMultiplier: (v: number) => void;
  setSensitivity: (s: number) => void;
  setAdsSensitivityMult: (v: number) => void;
  setFov: (f: number) => void;
  setQualityPreset: (p: QualityPreset) => void;
  setShadowQuality: (q: ShadowQuality) => void;
  setBloom: (b: boolean) => void;
  setParticles: (b: boolean) => void;
  setSpeedLines: (b: boolean) => void;
  setScreenShake: (b: boolean) => void;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setAmbientVolume: (v: number) => void;
  setAutoBhop: (b: boolean) => void;
  setEdgeGrab: (b: boolean) => void;
  setCrosshairStyle: (s: CrosshairStyle) => void;
  setCrosshairColor: (c: string) => void;
  setCrosshairSize: (s: number) => void;
  setShowSpeedMeter: (b: boolean) => void;
  setShowTimer: (b: boolean) => void;
  setShowCheckpoints: (b: boolean) => void;
  setShowTrackProgress: (b: boolean) => void;
  setHudScale: (s: number) => void;
  setHudOpacity: (o: number) => void;
  setHeadBob: (b: boolean) => void;
  setCameraSmoothing: (v: number) => void;
  setViewmodelVisible: (b: boolean) => void;
  setViewmodelBob: (v: number) => void;
  setFovScaling: (b: boolean) => void;
  setRtsPanSpeed: (v: number) => void;
  setRtsZoomSpeed: (v: number) => void;
  setRtsRotateSpeed: (v: number) => void;
  setRtsEdgeScrollEnabled: (b: boolean) => void;
  setSsao: (b: boolean) => void;
  setColorGrading: (b: boolean) => void;
  setFilmGrain: (b: boolean) => void;
  setChromaticAberration: (b: boolean) => void;
  setMotionBlur: (b: boolean) => void;
  setDepthOfField: (b: boolean) => void;
  setKeyBinding: (action: string, key: string) => void;
  resetKeyBindings: () => void;
  resetAll: () => void;
}

const DEFAULT_STATE = {
  sensitivity: DEFAULT_SENSITIVITY,
  adsSensitivityMult: 0.7,
  fov: 90,
  qualityPreset: QUALITY_PRESETS.HIGH as QualityPreset,
  shadowQuality: SHADOW_QUALITY_LEVELS.MEDIUM as ShadowQuality,
  bloom: true,
  particles: true,
  speedLines: true,
  screenShake: true,
  ssao: true,
  colorGrading: true,
  filmGrain: false,
  chromaticAberration: false,
  motionBlur: false,
  depthOfField: false,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  ambientVolume: 0.6,
  autoBhop: true,
  edgeGrab: true,
  crosshairStyle: CROSSHAIR_STYLES.DOT as CrosshairStyle,
  crosshairColor: '#ffffff',
  crosshairSize: 4,
  showSpeedMeter: true,
  showTimer: true,
  showCheckpoints: true,
  showTrackProgress: true,
  hudScale: 1.0,
  hudOpacity: 1.0,
  headBob: false,
  cameraSmoothing: 0,
  viewmodelVisible: true,
  viewmodelBob: 1.0,
  fovScaling: true,
  rtsPanSpeed: 40,
  rtsZoomSpeed: 0.1,
  rtsRotateSpeed: 2,
  rtsEdgeScrollEnabled: true,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      devSpeedMultiplier: 1.0,
      devGravityMultiplier: 1.0,

      setDevSpeedMultiplier: (devSpeedMultiplier) => set({ devSpeedMultiplier }),
      setDevGravityMultiplier: (devGravityMultiplier) => set({ devGravityMultiplier }),
      setSensitivity: (sensitivity) => set({ sensitivity }),
      setAdsSensitivityMult: (adsSensitivityMult) => set({ adsSensitivityMult }),
      setFov: (fov) => set({ fov }),
      setQualityPreset: (qualityPreset) => set({ qualityPreset }),
      setShadowQuality: (shadowQuality) => set({ shadowQuality }),
      setBloom: (bloom) => set({ bloom }),
      setParticles: (particles) => set({ particles }),
      setSpeedLines: (speedLines) => set({ speedLines }),
      setScreenShake: (screenShake) => set({ screenShake }),
      setSsao: (ssao) => set({ ssao }),
      setColorGrading: (colorGrading) => set({ colorGrading }),
      setFilmGrain: (filmGrain) => set({ filmGrain }),
      setChromaticAberration: (chromaticAberration) => set({ chromaticAberration }),
      setMotionBlur: (motionBlur) => set({ motionBlur }),
      setDepthOfField: (depthOfField) => set({ depthOfField }),
      setMasterVolume: (masterVolume) => set({ masterVolume }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      setAmbientVolume: (ambientVolume) => set({ ambientVolume }),
      setAutoBhop: (autoBhop) => set({ autoBhop }),
      setEdgeGrab: (edgeGrab) => set({ edgeGrab }),
      setCrosshairStyle: (crosshairStyle) => set({ crosshairStyle }),
      setCrosshairColor: (crosshairColor) => set({ crosshairColor }),
      setCrosshairSize: (crosshairSize) => set({ crosshairSize }),
      setShowSpeedMeter: (showSpeedMeter) => set({ showSpeedMeter }),
      setShowTimer: (showTimer) => set({ showTimer }),
      setShowCheckpoints: (showCheckpoints) => set({ showCheckpoints }),
      setShowTrackProgress: (showTrackProgress) => set({ showTrackProgress }),
      setHudScale: (hudScale) => set({ hudScale }),
      setHudOpacity: (hudOpacity) => set({ hudOpacity }),
      setHeadBob: (headBob) => set({ headBob }),
      setCameraSmoothing: (cameraSmoothing) => set({ cameraSmoothing }),
      setViewmodelVisible: (viewmodelVisible) => set({ viewmodelVisible }),
      setViewmodelBob: (viewmodelBob) => set({ viewmodelBob }),
      setFovScaling: (fovScaling) => set({ fovScaling }),
      setRtsPanSpeed: (rtsPanSpeed) => set({ rtsPanSpeed }),
      setRtsZoomSpeed: (rtsZoomSpeed) => set({ rtsZoomSpeed }),
      setRtsRotateSpeed: (rtsRotateSpeed) => set({ rtsRotateSpeed }),
      setRtsEdgeScrollEnabled: (rtsEdgeScrollEnabled) => set({ rtsEdgeScrollEnabled }),
      setKeyBinding: (action, newKey) => set((s) => {
        const bindings = { ...s.keyBindings, [action]: newKey };
        // Swap: if another action already uses this key, give it the old key
        const oldKey = s.keyBindings[action];
        const conflicting = Object.keys(s.keyBindings).find(
          (a) => a !== action && s.keyBindings[a] === newKey,
        );
        if (conflicting) {
          bindings[conflicting] = oldKey;
        }
        return { keyBindings: bindings };
      }),
      resetKeyBindings: () => set({ keyBindings: { ...DEFAULT_KEY_BINDINGS } }),
      resetAll: () => set({ ...DEFAULT_STATE, keyBindings: { ...DEFAULT_KEY_BINDINGS } }),
    }),
    {
      name: 'velocity-settings',
      partialize: (state) => ({
        sensitivity: state.sensitivity,
        adsSensitivityMult: state.adsSensitivityMult,
        fov: state.fov,
        qualityPreset: state.qualityPreset,
        shadowQuality: state.shadowQuality,
        bloom: state.bloom,
        particles: state.particles,
        speedLines: state.speedLines,
        screenShake: state.screenShake,
        ssao: state.ssao,
        colorGrading: state.colorGrading,
        filmGrain: state.filmGrain,
        chromaticAberration: state.chromaticAberration,
        motionBlur: state.motionBlur,
        depthOfField: state.depthOfField,
        masterVolume: state.masterVolume,
        sfxVolume: state.sfxVolume,
        musicVolume: state.musicVolume,
        ambientVolume: state.ambientVolume,
        autoBhop: state.autoBhop,
        edgeGrab: state.edgeGrab,
        crosshairStyle: state.crosshairStyle,
        crosshairColor: state.crosshairColor,
        crosshairSize: state.crosshairSize,
        showSpeedMeter: state.showSpeedMeter,
        showTimer: state.showTimer,
        showCheckpoints: state.showCheckpoints,
        showTrackProgress: state.showTrackProgress,
        hudScale: state.hudScale,
        hudOpacity: state.hudOpacity,
        headBob: state.headBob,
        cameraSmoothing: state.cameraSmoothing,
        viewmodelVisible: state.viewmodelVisible,
        viewmodelBob: state.viewmodelBob,
        fovScaling: state.fovScaling,
        rtsPanSpeed: state.rtsPanSpeed,
        rtsZoomSpeed: state.rtsZoomSpeed,
        rtsRotateSpeed: state.rtsRotateSpeed,
        rtsEdgeScrollEnabled: state.rtsEdgeScrollEnabled,
        keyBindings: state.keyBindings,
      }),
    }
  )
);
