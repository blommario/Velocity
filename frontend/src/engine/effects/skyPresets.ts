/**
 * Procedural skybox presets — sun color, zenith/horizon gradient,
 * sun position, and atmospheric settings for different times of day.
 *
 * Depends on: (none — pure data)
 * Used by: ProceduralSkybox
 */

export interface SkyPreset {
  sunColor: [number, number, number];
  zenithColor: [number, number, number];
  horizonColor: [number, number, number];
  sunPos: [number, number, number];
  sunSize: number;
  sunIntensity: number;
}

export const SKY_PRESETS = {
  day: {
    sunColor: [1.0, 0.95, 0.8],
    zenithColor: [0.18, 0.32, 0.65],
    horizonColor: [0.55, 0.65, 0.85],
    sunPos: [0.4, 0.8, 0.3],
    sunSize: 0.02,
    sunIntensity: 3.0,
  },
  sunset: {
    sunColor: [1.0, 0.5, 0.15],
    zenithColor: [0.12, 0.1, 0.35],
    horizonColor: [0.85, 0.35, 0.15],
    sunPos: [0.6, 0.15, 0.2],
    sunSize: 0.04,
    sunIntensity: 4.0,
  },
  night: {
    sunColor: [0.6, 0.7, 1.0],
    zenithColor: [0.02, 0.02, 0.08],
    horizonColor: [0.06, 0.06, 0.15],
    sunPos: [0.3, 0.5, -0.4],
    sunSize: 0.01,
    sunIntensity: 1.5,
  },
  neon: {
    sunColor: [0.4, 0.0, 1.0],
    zenithColor: [0.03, 0.01, 0.1],
    horizonColor: [0.15, 0.0, 0.3],
    sunPos: [0.0, 0.6, 0.5],
    sunSize: 0.03,
    sunIntensity: 5.0,
  },
  sky: {
    sunColor: [1.0, 0.9, 0.7],
    zenithColor: [0.15, 0.3, 0.6],
    horizonColor: [0.5, 0.6, 0.8],
    sunPos: [0.5, 0.7, 0.4],
    sunSize: 0.025,
    sunIntensity: 2.5,
  },
} as const satisfies Record<string, SkyPreset>;

export type ProceduralSkyPresetName = keyof typeof SKY_PRESETS;
