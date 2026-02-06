import type { MapData } from '../types';

/** The Gauntlet — Hard. Industrial/mechanical with moving platforms. Requires all mechanics. Par: 120s */
export const THE_GAUNTLET: MapData = {
  spawnPoint: [0, 2, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Industrial starting area
    { shape: 'box', position: [0, -0.5, 0], size: [12, 1, 12], color: '#4a4a4a' },
    // Metal grating floor accents
    { shape: 'box', position: [0, 0.02, 0], size: [10, 0.05, 10], color: '#666666' },

    // Section 1: Speed corridor with obstacles
    { shape: 'box', position: [0, -0.5, -20], size: [8, 1, 28], color: '#3a3a3a' },
    // Walls
    { shape: 'box', position: [-4.5, 3, -20], size: [1, 7, 28], color: '#555555' },
    { shape: 'box', position: [4.5, 3, -20], size: [1, 7, 28], color: '#555555' },
    // Low barriers to slide under
    { shape: 'box', position: [0, 2.5, -15], size: [8, 3.5, 0.5], color: '#aa4444' },
    { shape: 'box', position: [0, 2.5, -25], size: [8, 3.5, 0.5], color: '#aa4444' },

    // Section 2: Vertical shaft
    { shape: 'box', position: [0, -0.5, -40], size: [14, 1, 10], color: '#3a3a3a' },
    // Walls around shaft
    { shape: 'box', position: [-5, 6, -45], size: [1, 14, 10], color: '#555555' },
    { shape: 'box', position: [5, 6, -45], size: [1, 14, 10], color: '#555555' },
    // Platforms at various heights (for rocket jumping)
    { shape: 'box', position: [-2, 3, -45], size: [4, 0.5, 4], color: '#4a5a4a' },
    { shape: 'box', position: [2, 6, -42], size: [4, 0.5, 4], color: '#4a5a4a' },
    { shape: 'box', position: [-2, 9, -47], size: [4, 0.5, 4], color: '#4a5a4a' },
    // Top of shaft
    { shape: 'box', position: [0, 12, -45], size: [8, 1, 10], color: '#3a3a3a' },

    // Section 3: Catwalk with wall running
    { shape: 'box', position: [0, 11.5, -58], size: [3, 0.5, 16], color: '#666666' },
    // Wall run walls
    { shape: 'box', position: [-4, 14, -58], size: [1, 8, 16], color: '#555555' },
    { shape: 'box', position: [4, 14, -58], size: [1, 8, 16], color: '#555555' },
    // Gap in catwalk (must wall run or jump)
    // (catwalk is narrow, gap is the section from z=-62 to z=-66 — no floor there)

    // Section 3b: After wall run
    { shape: 'box', position: [0, 11.5, -72], size: [8, 0.5, 8], color: '#3a3a3a' },

    // Section 4: Descent with surf ramps
    { shape: 'box', position: [0, 6, -86], size: [10, 1, 12], color: '#3a3a3a' },

    // Section 5: Industrial floor — grapple + platforms
    { shape: 'box', position: [0, 0, -104], size: [16, 1, 20], color: '#4a4a4a' },
    // Pillars
    { shape: 'box', position: [-6, 4, -98], size: [2, 8, 2], color: '#666666' },
    { shape: 'box', position: [6, 4, -98], size: [2, 8, 2], color: '#666666' },
    { shape: 'box', position: [-6, 4, -110], size: [2, 8, 2], color: '#666666' },
    { shape: 'box', position: [6, 4, -110], size: [2, 8, 2], color: '#666666' },

    // High platform (grapple target)
    { shape: 'box', position: [0, 14, -104], size: [6, 1, 6], color: '#5a5a6a' },

    // Final gauntlet — narrow beam
    { shape: 'box', position: [0, 13.5, -118], size: [2, 0.5, 20], color: '#aa6644' },

    // Finish platform
    { shape: 'box', position: [0, 13, -132], size: [12, 1, 8], color: '#4a5a4a' },
  ],

  checkpoints: [
    { position: [0, 1, -35], size: [8, 5, 3], index: 0 },
    { position: [0, 14, -45], size: [8, 5, 3], index: 1 },
    { position: [0, 13, -72], size: [8, 5, 3], index: 2 },
    { position: [0, 2, -104], size: [10, 5, 3], index: 3 },
  ],

  finish: {
    position: [0, 15, -134],
    size: [10, 5, 3],
  },

  killZones: [
    { position: [0, -30, -70], size: [200, 5, 200] },
  ],

  surfRamps: [
    { position: [-3, 9, -80], size: [8, 0.3, 12], rotation: [0, 0, 0.55], color: '#6a6a7a' },
    { position: [3, 9, -80], size: [8, 0.3, 12], rotation: [0, 0, -0.55], color: '#6a6a7a' },
  ],

  boostPads: [
    { position: [0, -0.3, -8], direction: [0, 0, -1], speed: 500, color: '#ff6600' },
  ],

  speedGates: [
    { position: [0, 1, -30], size: [6, 5, 1], color: '#ff8800' },
  ],

  launchPads: [
    { position: [0, 6.2, -82], direction: [0, 0.8, -0.6], speed: 300 },
  ],

  grapplePoints: [
    { position: [0, 18, -100] },
    { position: [0, 18, -115] },
  ],

  ammoPickups: [
    { position: [0, 0.5, -38], weaponType: 'rocket', amount: 3 },
    { position: [0, 1, -100], weaponType: 'rocket', amount: 2 },
    { position: [0, 1, -100], weaponType: 'grenade', amount: 2 },
  ],

  movingPlatforms: [
    {
      size: [4, 0.5, 4],
      waypoints: [[0, 3, -40], [0, 11, -40]],
      speed: 8,
      color: '#888844',
      pauseTime: 0.5,
    },
    {
      size: [3, 0.5, 3],
      waypoints: [[-3, 11.5, -64], [3, 11.5, -64]],
      speed: 4,
      color: '#888844',
      pauseTime: 0.3,
    },
  ],

  settings: {
    maxRocketAmmo: 5,
    maxGrenadeAmmo: 3,
    parTime: 120,
  },

  lighting: {
    ambientIntensity: 0.25,
    ambientColor: '#442200',
    directionalIntensity: 0.8,
    directionalColor: '#ffaa66',
    directionalPosition: [30, 50, -30],
    hemisphereGround: '#2a2a2a',
    hemisphereSky: '#554433',
    hemisphereIntensity: 0.25,
    fogColor: '#1a1510',
    fogNear: 30,
    fogFar: 150,
  },

  backgroundColor: '#1a1510',
};
