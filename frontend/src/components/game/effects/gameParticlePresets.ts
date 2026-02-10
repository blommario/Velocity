/**
 * Velocity-specific particle presets.
 *
 * Extends the generic engine presets with game-specific effects
 * (boost pads, grapple trails, weapon impacts, etc.).
 *
 * Game code should import from here for Velocity-specific presets,
 * or from engine/effects/particlePresets for generic ones.
 */
import { PARTICLE_PRESETS, type ParticlePreset } from '../../../engine/effects/particlePresets';

export const GAME_PARTICLE_PRESETS = {
  /** Upward particle stream from boost pads */
  boost: {
    name: 'Boost',
    count: 200,
    lifetime: [0.5, 1.2],
    speed: 2.0,
    spread: 1.5,
    gravity: -0.5,
    direction: [0, 1, 0],
    color: '#00ffaa',
    spriteSize: 0.1,
    drag: 0.3,
  },

  /** Trail behind grapple hook projectile */
  grappleTrail: {
    name: 'GrappleTrail',
    count: 32,
    lifetime: [0.15, 0.4],
    speed: 0.3,
    spread: 0.15,
    gravity: 0.0,
    direction: [0, 0, 0],
    color: '#a78bfa',
    spriteSize: 0.08,
    drag: 0.0,
  },
} as const satisfies Record<string, ParticlePreset>;

/** All presets: engine generic + Velocity-specific */
export const ALL_PARTICLE_PRESETS = {
  ...PARTICLE_PRESETS,
  ...GAME_PARTICLE_PRESETS,
} as const;

export type GameParticlePresetName = keyof typeof GAME_PARTICLE_PRESETS;
export type AllParticlePresetName = keyof typeof ALL_PARTICLE_PRESETS;
