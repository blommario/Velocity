/**
 * Shadow quality presets and CSM configuration constants.
 *
 * Depends on: —
 * Used by: useShadowLight, settingsStore
 */
export const SHADOW_QUALITY_LEVELS = {
  OFF: 'off',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type ShadowQuality = (typeof SHADOW_QUALITY_LEVELS)[keyof typeof SHADOW_QUALITY_LEVELS];

export interface ShadowPreset {
  enabled: boolean;
  mapSize: number;
  cascades: number;
  maxFar: number;
  bias: number;
  normalBias: number;
}

export const SHADOW_PRESETS: Record<ShadowQuality, ShadowPreset> = {
  off: {
    enabled: false,
    mapSize: 0,
    cascades: 0,
    maxFar: 0,
    bias: 0,
    normalBias: 0,
  },
  low: {
    enabled: true,
    mapSize: 512,
    cascades: 2,
    maxFar: 150,
    bias: -0.0005,
    normalBias: 0.04,
  },
  medium: {
    enabled: true,
    mapSize: 1024,
    cascades: 3,
    maxFar: 200,
    bias: -0.0005,
    normalBias: 0.02,
  },
  high: {
    enabled: true,
    mapSize: 2048,
    cascades: 4,
    maxFar: 300,
    bias: -0.0003,
    normalBias: 0.02,
  },
} as const;

/** Map quality preset → default shadow quality */
export function shadowQualityFromPreset(preset: string): ShadowQuality {
  switch (preset) {
    case 'ultra': return SHADOW_QUALITY_LEVELS.HIGH;
    case 'high': return SHADOW_QUALITY_LEVELS.MEDIUM;
    case 'medium': return SHADOW_QUALITY_LEVELS.LOW;
    default: return SHADOW_QUALITY_LEVELS.OFF;
  }
}
