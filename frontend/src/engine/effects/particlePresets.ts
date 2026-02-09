/**
 * Particle preset configurations for the GpuParticles system.
 *
 * Each preset defines visual + physics behaviour for a particle type.
 * Used as input to GpuParticles or EnvironmentalParticles components.
 *
 * Engine module — no game store imports.
 */

export interface ParticlePreset {
  /** Display name for dev log */
  name: string;
  /** Number of particles */
  count: number;
  /** Particle lifetime range [min, max] in seconds */
  lifetime: [number, number];
  /** Initial speed (units/sec) */
  speed: number;
  /** Random spread radius around emitter */
  spread: number;
  /** Gravity applied to particles (negative = downward in TSL compute) */
  gravity: number;
  /** Base direction [x, y, z] (normalized) */
  direction: [number, number, number];
  /** Hex color string */
  color: string;
  /** Sprite size in world units */
  spriteSize: number;
  /** Drag coefficient (0 = no drag, higher = more drag) */
  drag: number;
}

export const PARTICLE_PRESETS = {
  /** Dark smoke rising from explosions/fires */
  smoke: {
    name: 'Smoke',
    count: 48,
    lifetime: [1.5, 3.0],
    speed: 1.5,
    spread: 1.0,
    gravity: -0.3,
    direction: [0, 1, 0],
    color: '#555555',
    spriteSize: 0.4,
    drag: 1.5,
  },

  /** Hot sparks scattering from impacts */
  sparks: {
    name: 'Sparks',
    count: 32,
    lifetime: [0.3, 0.8],
    speed: 8.0,
    spread: 0.5,
    gravity: 6.0,
    direction: [0, 1, 0],
    color: '#ffaa22',
    spriteSize: 0.08,
    drag: 0.5,
  },

  /** Kicked-up dust from ground impacts or landing */
  dust: {
    name: 'Dust',
    count: 24,
    lifetime: [0.8, 1.5],
    speed: 2.0,
    spread: 1.5,
    gravity: 0.5,
    direction: [0, 0.3, 0],
    color: '#aa9977',
    spriteSize: 0.25,
    drag: 2.0,
  },

  /** Hard debris chunks */
  debris: {
    name: 'Debris',
    count: 16,
    lifetime: [0.5, 1.2],
    speed: 10.0,
    spread: 0.3,
    gravity: 12.0,
    direction: [0, 1, 0],
    color: '#888888',
    spriteSize: 0.1,
    drag: 0.3,
  },

  /** Continuous trail (e.g. speed boost, rocket exhaust) */
  trail: {
    name: 'Trail',
    count: 64,
    lifetime: [0.2, 0.5],
    speed: 0.5,
    spread: 0.2,
    gravity: 0.0,
    direction: [0, 0, 0],
    color: '#66ccff',
    spriteSize: 0.12,
    drag: 0.0,
  },

  /** Gentle snowfall */
  snow: {
    name: 'Snow',
    count: 256,
    lifetime: [4.0, 8.0],
    speed: 0.8,
    spread: 40.0,
    gravity: 1.2,
    direction: [0, -1, 0],
    color: '#eeeeff',
    spriteSize: 0.15,
    drag: 0.8,
  },

  /** Floating ash / embers */
  ash: {
    name: 'Ash',
    count: 128,
    lifetime: [3.0, 6.0],
    speed: 0.5,
    spread: 30.0,
    gravity: -0.2,
    direction: [0, 1, 0],
    color: '#ff8844',
    spriteSize: 0.08,
    drag: 0.5,
  },

  /** Drifting pollen / dust motes */
  pollen: {
    name: 'Pollen',
    count: 96,
    lifetime: [5.0, 10.0],
    speed: 0.3,
    spread: 25.0,
    gravity: -0.05,
    direction: [0.2, 0.1, 0],
    color: '#ffffaa',
    spriteSize: 0.06,
    drag: 0.3,
  },
} as const satisfies Record<string, ParticlePreset>;

export type ParticlePresetName = keyof typeof PARTICLE_PRESETS;
