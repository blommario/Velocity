import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PHYSICS } from '../components/game/physics/constants';

// ── Key Bindings ──

export const DEFAULT_KEY_BINDINGS: Record<string, string> = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  crouch: 'KeyC',
  fireRocket: 'Mouse0',
  fireGrenade: 'Mouse2',
  grapple: 'KeyE',
  reload: 'KeyR',
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

  // Video
  fov: number;
  qualityPreset: QualityPreset;
  shadows: boolean;
  bloom: boolean;
  particles: boolean;
  speedLines: boolean;
  screenShake: boolean;

  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  ambientVolume: number;

  // Gameplay
  autoBhop: boolean;
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

  // Dev Tweaks (session only, not persisted)
  devSpeedMultiplier: number;
  devGravityMultiplier: number;

  // Key Bindings
  keyBindings: Record<string, string>;

  // Actions
  setDevSpeedMultiplier: (v: number) => void;
  setDevGravityMultiplier: (v: number) => void;
  setSensitivity: (s: number) => void;
  setFov: (f: number) => void;
  setQualityPreset: (p: QualityPreset) => void;
  setShadows: (b: boolean) => void;
  setBloom: (b: boolean) => void;
  setParticles: (b: boolean) => void;
  setSpeedLines: (b: boolean) => void;
  setScreenShake: (b: boolean) => void;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setAmbientVolume: (v: number) => void;
  setAutoBhop: (b: boolean) => void;
  setCrosshairStyle: (s: CrosshairStyle) => void;
  setCrosshairColor: (c: string) => void;
  setCrosshairSize: (s: number) => void;
  setShowSpeedMeter: (b: boolean) => void;
  setShowTimer: (b: boolean) => void;
  setShowCheckpoints: (b: boolean) => void;
  setShowTrackProgress: (b: boolean) => void;
  setHudScale: (s: number) => void;
  setHudOpacity: (o: number) => void;
  setKeyBinding: (action: string, key: string) => void;
  resetKeyBindings: () => void;
  resetAll: () => void;
}

const DEFAULT_STATE = {
  sensitivity: PHYSICS.DEFAULT_SENSITIVITY,
  fov: 90,
  qualityPreset: QUALITY_PRESETS.HIGH as QualityPreset,
  shadows: true,
  bloom: true,
  particles: true,
  speedLines: true,
  screenShake: true,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  ambientVolume: 0.6,
  autoBhop: true,
  crosshairStyle: CROSSHAIR_STYLES.DOT as CrosshairStyle,
  crosshairColor: '#ffffff',
  crosshairSize: 4,
  showSpeedMeter: true,
  showTimer: true,
  showCheckpoints: true,
  showTrackProgress: true,
  hudScale: 1.0,
  hudOpacity: 1.0,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      devSpeedMultiplier: 0.125,
      devGravityMultiplier: 0.125,

      setDevSpeedMultiplier: (devSpeedMultiplier) => set({ devSpeedMultiplier }),
      setDevGravityMultiplier: (devGravityMultiplier) => set({ devGravityMultiplier }),
      setSensitivity: (sensitivity) => set({ sensitivity }),
      setFov: (fov) => set({ fov }),
      setQualityPreset: (qualityPreset) => set({ qualityPreset }),
      setShadows: (shadows) => set({ shadows }),
      setBloom: (bloom) => set({ bloom }),
      setParticles: (particles) => set({ particles }),
      setSpeedLines: (speedLines) => set({ speedLines }),
      setScreenShake: (screenShake) => set({ screenShake }),
      setMasterVolume: (masterVolume) => set({ masterVolume }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      setAmbientVolume: (ambientVolume) => set({ ambientVolume }),
      setAutoBhop: (autoBhop) => set({ autoBhop }),
      setCrosshairStyle: (crosshairStyle) => set({ crosshairStyle }),
      setCrosshairColor: (crosshairColor) => set({ crosshairColor }),
      setCrosshairSize: (crosshairSize) => set({ crosshairSize }),
      setShowSpeedMeter: (showSpeedMeter) => set({ showSpeedMeter }),
      setShowTimer: (showTimer) => set({ showTimer }),
      setShowCheckpoints: (showCheckpoints) => set({ showCheckpoints }),
      setShowTrackProgress: (showTrackProgress) => set({ showTrackProgress }),
      setHudScale: (hudScale) => set({ hudScale }),
      setHudOpacity: (hudOpacity) => set({ hudOpacity }),
      setKeyBinding: (action, key) => set((s) => ({
        keyBindings: { ...s.keyBindings, [action]: key },
      })),
      resetKeyBindings: () => set({ keyBindings: { ...DEFAULT_KEY_BINDINGS } }),
      resetAll: () => set({ ...DEFAULT_STATE }),
    }),
    {
      name: 'velocity-settings',
      partialize: (state) => ({
        sensitivity: state.sensitivity,
        fov: state.fov,
        qualityPreset: state.qualityPreset,
        shadows: state.shadows,
        bloom: state.bloom,
        particles: state.particles,
        speedLines: state.speedLines,
        screenShake: state.screenShake,
        masterVolume: state.masterVolume,
        sfxVolume: state.sfxVolume,
        musicVolume: state.musicVolume,
        ambientVolume: state.ambientVolume,
        autoBhop: state.autoBhop,
        crosshairStyle: state.crosshairStyle,
        crosshairColor: state.crosshairColor,
        crosshairSize: state.crosshairSize,
        showSpeedMeter: state.showSpeedMeter,
        showTimer: state.showTimer,
        showCheckpoints: state.showCheckpoints,
        showTrackProgress: state.showTrackProgress,
        hudScale: state.hudScale,
        hudOpacity: state.hudOpacity,
        keyBindings: state.keyBindings,
      }),
    }
  )
);
