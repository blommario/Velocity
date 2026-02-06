import { create } from 'zustand';
import { PHYSICS } from '../components/game/physics/constants';

interface SettingsState {
  sensitivity: number;
  fov: number;
  autoBhop: boolean;
  setSensitivity: (s: number) => void;
  setFov: (f: number) => void;
  setAutoBhop: (b: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  sensitivity: PHYSICS.DEFAULT_SENSITIVITY,
  fov: 90,
  autoBhop: true,
  setSensitivity: (sensitivity) => set({ sensitivity }),
  setFov: (fov) => set({ fov }),
  setAutoBhop: (autoBhop) => set({ autoBhop }),
}));
