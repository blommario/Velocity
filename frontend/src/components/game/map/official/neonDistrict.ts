import type { MapData } from '../types';

/** Neon District — Medium. Cyberpunk city with wall running, speed gates, boost pads. Par: 75s */
export const NEON_DISTRICT: MapData = {
  spawnPoint: [0, 2, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Street level start
    { shape: 'box', position: [0, -0.5, 0], size: [14, 1, 14], color: '#2a2a3a' },

    // Main street (long corridor)
    { shape: 'box', position: [0, -0.5, -25], size: [10, 1, 36], color: '#2a2a3a' },
    // Left buildings (wall run surfaces)
    { shape: 'box', position: [-6, 5, -25], size: [2, 12, 36], color: '#1a1a2e' },
    // Right buildings
    { shape: 'box', position: [6, 5, -25], size: [2, 12, 36], color: '#1a1a2e' },

    // Neon accent strips on walls
    { shape: 'box', position: [-5.05, 3, -25], size: [0.1, 0.5, 36], color: '#ff00ff', emissive: '#ff00ff', emissiveIntensity: 2 },
    { shape: 'box', position: [5.05, 3, -25], size: [0.1, 0.5, 36], color: '#00ffff', emissive: '#00ffff', emissiveIntensity: 2 },
    { shape: 'box', position: [-5.05, 7, -25], size: [0.1, 0.5, 36], color: '#ff00ff', emissive: '#ff00ff', emissiveIntensity: 1.5 },
    { shape: 'box', position: [5.05, 7, -25], size: [0.1, 0.5, 36], color: '#00ffff', emissive: '#00ffff', emissiveIntensity: 1.5 },

    // Glass floor section
    { shape: 'box', position: [0, -0.5, -50], size: [10, 0.3, 8], color: '#4488aa', transparent: true, opacity: 0.3 },

    // Elevated rooftop section (accessible via wall run + grenade jump)
    { shape: 'box', position: [-6, 10, -50], size: [8, 1, 12], color: '#2a2a3a' },
    { shape: 'box', position: [-6, 10, -65], size: [8, 1, 8], color: '#2a2a3a' },

    // Main path — alley turn right
    { shape: 'box', position: [10, -0.5, -55], size: [16, 1, 8], color: '#2a2a3a' },

    // Alley walls
    { shape: 'box', position: [10, 3, -59.5], size: [16, 7, 1], color: '#1a1a2e' },
    { shape: 'box', position: [10, 3, -50.5], size: [16, 7, 1], color: '#1a1a2e' },
    // Neon on alley walls
    { shape: 'box', position: [10, 2, -59], size: [16, 0.3, 0.1], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 2 },

    // Second street going +X
    { shape: 'box', position: [22, -0.5, -55], size: [8, 1, 30], color: '#2a2a3a' },
    // Walls
    { shape: 'box', position: [18, 5, -55], size: [1, 12, 30], color: '#1a1a2e' },
    { shape: 'box', position: [26.5, 5, -55], size: [1, 12, 30], color: '#1a1a2e' },
    // Neon strips
    { shape: 'box', position: [18.55, 4, -55], size: [0.1, 0.5, 30], color: '#00ff88', emissive: '#00ff88', emissiveIntensity: 2 },
    { shape: 'box', position: [25.95, 4, -55], size: [0.1, 0.5, 30], color: '#ff0088', emissive: '#ff0088', emissiveIntensity: 2 },

    // Platform hop section
    { shape: 'box', position: [22, 1, -75], size: [5, 0.5, 5], color: '#3a3a5a' },
    { shape: 'box', position: [22, 2.5, -84], size: [5, 0.5, 5], color: '#3a3a5a' },
    { shape: 'box', position: [22, 4, -93], size: [5, 0.5, 5], color: '#3a3a5a' },

    // Final plaza
    { shape: 'box', position: [22, 3.5, -105], size: [20, 1, 16], color: '#2a2a3a' },
    // Neon floor accent
    { shape: 'box', position: [22, 4.02, -105], size: [18, 0.05, 14], color: '#4400ff', emissive: '#4400ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.3 },
  ],

  checkpoints: [
    { position: [0, 2, -40], size: [10, 5, 3], index: 0 },
    { position: [22, 2, -55], size: [8, 5, 3], index: 1 },
    { position: [22, 5.5, -93], size: [6, 5, 3], index: 2 },
  ],

  finish: {
    position: [22, 6, -110],
    size: [16, 5, 3],
  },

  killZones: [
    { position: [0, -15, -60], size: [200, 5, 200] },
  ],

  speedGates: [
    { position: [0, 2, -20], size: [8, 6, 1], color: '#00ffff' },
    { position: [22, 2, -65], size: [6, 6, 1], color: '#ff00ff' },
  ],

  boostPads: [
    { position: [0, -0.3, -10], direction: [0, 0, -1], speed: 450, color: '#ff00ff' },
    { position: [14, -0.3, -55], direction: [1, 0, 0], speed: 400, color: '#00ffff' },
  ],

  launchPads: [
    { position: [22, -0.3, -70], direction: [0, 0.7, -0.7], speed: 500, color: '#ff4400' },
  ],

  ammoPickups: [
    { position: [22, 1, -50], weaponType: 'grenade', amount: 2 },
  ],

  settings: {
    maxRocketAmmo: 0,
    maxGrenadeAmmo: 3,
    parTime: 75,
  },

  lighting: {
    ambientIntensity: 0.2,
    ambientColor: '#2200aa',
    directionalIntensity: 0.4,
    directionalColor: '#8888ff',
    directionalPosition: [20, 40, -10],
    hemisphereGround: '#110022',
    hemisphereSky: '#220044',
    hemisphereIntensity: 0.3,
    fogColor: '#0a0a1e',
    fogNear: 40,
    fogFar: 140,
  },

  backgroundColor: '#0a0a1e',
};
