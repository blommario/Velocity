import type { MapData } from '../types';

/** First Steps — Easy tutorial map. Corridors, curves, small gaps. Par: 45s */
export const FIRST_STEPS: MapData = {
  spawnPoint: [0, 1.5, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Starting platform
    { shape: 'box', position: [0, -0.5, 0], size: [10, 1, 10], color: '#4a4a4a' },

    // Straight corridor
    { shape: 'box', position: [0, -0.5, -15], size: [6, 1, 20], color: '#555555' },
    // Left wall
    { shape: 'box', position: [-3.5, 2, -15], size: [1, 5, 20], color: '#3a3a4a' },
    // Right wall
    { shape: 'box', position: [3.5, 2, -15], size: [1, 5, 20], color: '#3a3a4a' },

    // First turn — right
    { shape: 'box', position: [8, -0.5, -27], size: [22, 1, 6], color: '#555555' },
    // Outer wall of turn
    { shape: 'box', position: [8, 2, -30.5], size: [22, 5, 1], color: '#3a3a4a' },
    { shape: 'box', position: [8, 2, -23.5], size: [22, 5, 1], color: '#3a3a4a' },

    // Second corridor going +X
    { shape: 'box', position: [20, -0.5, -40], size: [6, 1, 22], color: '#555555' },
    { shape: 'box', position: [16.5, 2, -40], size: [1, 5, 22], color: '#3a3a4a' },
    { shape: 'box', position: [23.5, 2, -40], size: [1, 5, 22], color: '#3a3a4a' },

    // Gentle ramp up
    { shape: 'box', position: [20, 1.5, -55], size: [6, 0.3, 10], rotation: [-0.15, 0, 0], color: '#5a6a4a' },

    // Elevated platform after ramp
    { shape: 'box', position: [20, 2.5, -63], size: [10, 1, 8], color: '#4a5a5a' },

    // Gap jump section — three platforms
    { shape: 'box', position: [20, 2.5, -72], size: [5, 1, 4], color: '#5a4a5a' },
    { shape: 'box', position: [20, 2.5, -80], size: [5, 1, 4], color: '#5a4a5a' },
    { shape: 'box', position: [20, 2.5, -88], size: [5, 1, 4], color: '#5a4a5a' },

    // Landing after gaps
    { shape: 'box', position: [20, 2, -96], size: [10, 1, 8], color: '#4a5a5a' },

    // Bhop corridor (wider)
    { shape: 'box', position: [20, 1.5, -115], size: [8, 1, 30], color: '#555555' },
    { shape: 'box', position: [15.5, 3, -115], size: [1, 4, 30], color: '#3a3a4a' },
    { shape: 'box', position: [24.5, 3, -115], size: [1, 4, 30], color: '#3a3a4a' },

    // Final approach
    { shape: 'box', position: [20, 1, -135], size: [12, 1, 10], color: '#4a4a5a' },
  ],

  checkpoints: [
    { position: [20, 4, -55], size: [6, 6, 3], index: 0 },
    { position: [20, 4, -88], size: [6, 6, 3], index: 1 },
    { position: [20, 3, -115], size: [8, 5, 3], index: 2 },
  ],

  finish: {
    position: [20, 3, -137],
    size: [10, 5, 3],
  },

  killZones: [
    { position: [0, -20, -70], size: [200, 5, 200] },
  ],

  boostPads: [
    { position: [0, 0.1, -8], direction: [0, 0, -1], speed: 350 },
  ],

  settings: {
    maxRocketAmmo: 0,
    maxGrenadeAmmo: 0,
    parTime: 45,
  },

  lighting: {
    ambientIntensity: 0.5,
    directionalIntensity: 1.0,
    directionalPosition: [30, 60, 20],
    fogColor: '#1e2a3a',
    fogNear: 60,
    fogFar: 180,
  },

  backgroundColor: '#1e2a3a',
};
