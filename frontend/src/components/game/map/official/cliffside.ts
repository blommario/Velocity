import type { MapData } from '../types';

/** Cliffside — Medium. Rocky mountain with surf ramps and rocket jump shortcuts. Par: 90s */
export const CLIFFSIDE: MapData = {
  spawnPoint: [0, 2, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Starting cliff ledge
    { shape: 'box', position: [0, 0, 0], size: [12, 2, 12], color: '#6a5a4a' },

    // Rocky path forward (descending slightly)
    { shape: 'box', position: [0, -0.5, -14], size: [6, 1, 16], color: '#7a6a5a' },

    // Bridge over gap
    { shape: 'box', position: [0, -1, -28], size: [4, 0.5, 10], color: '#8a7a6a' },

    // Cliff platform
    { shape: 'box', position: [0, -1.5, -38], size: [14, 1, 10], color: '#6a5a4a' },

    // Ascending rocky stairs (staggered blocks)
    { shape: 'box', position: [-5, -0.5, -46], size: [4, 1, 4], color: '#7a6a5a' },
    { shape: 'box', position: [-5, 0.5, -52], size: [4, 1, 4], color: '#7a6a5a' },
    { shape: 'box', position: [-5, 1.5, -58], size: [4, 1, 4], color: '#7a6a5a' },
    { shape: 'box', position: [0, 2.5, -62], size: [6, 1, 6], color: '#6a5a4a' },

    // High cliff path
    { shape: 'box', position: [8, 2.5, -62], size: [10, 1, 4], color: '#7a6a5a' },
    { shape: 'box', position: [16, 2, -68], size: [6, 1, 12], color: '#6a5a4a' },

    // Cliff wall (for rocket jump shortcut above)
    { shape: 'box', position: [16, 8, -62], size: [10, 10, 2], color: '#5a4a3a' },

    // Upper shortcut platform (accessible via rocket jump)
    { shape: 'box', position: [16, 12, -75], size: [6, 1, 8], color: '#8a6a4a' },

    // Main path continues — winding down
    { shape: 'box', position: [16, 1, -80], size: [8, 1, 8], color: '#7a6a5a' },
    { shape: 'box', position: [8, 0, -88], size: [8, 1, 8], color: '#6a5a4a' },
    { shape: 'box', position: [0, -0.5, -96], size: [8, 1, 8], color: '#7a6a5a' },

    // Hidden cave entrance (rocket jump shortcut area)
    { shape: 'box', position: [-12, -1, -88], size: [8, 0.5, 8], color: '#4a3a2a' },
    { shape: 'box', position: [-12, 1, -88], size: [10, 4, 0.5], color: '#4a3a2a' }, // cave ceiling
    { shape: 'box', position: [-17, -0.5, -88], size: [0.5, 3, 8], color: '#4a3a2a' }, // cave wall
    { shape: 'box', position: [-7, -0.5, -88], size: [0.5, 3, 8], color: '#4a3a2a' }, // cave wall

    // Final cliff descent
    { shape: 'box', position: [0, -2, -108], size: [10, 1, 16], color: '#6a5a4a' },

    // Finish platform (wide, grand)
    { shape: 'box', position: [0, -3, -122], size: [16, 1, 12], color: '#5a6a5a' },
  ],

  checkpoints: [
    { position: [0, 0, -38], size: [8, 5, 3], index: 0 },
    { position: [0, 3, -62], size: [6, 5, 3], index: 1 },
    { position: [0, 1, -96], size: [8, 5, 3], index: 2 },
  ],

  finish: {
    position: [0, -1, -125],
    size: [14, 5, 3],
  },

  killZones: [
    { position: [0, -25, -60], size: [200, 5, 200] },
  ],

  surfRamps: [
    // Surf section near middle of the map
    { position: [0, -1, -104], size: [8, 0.3, 14], rotation: [0, 0, 0.6], color: '#7a8a6a' },
    { position: [6, -1, -104], size: [8, 0.3, 14], rotation: [0, 0, -0.6], color: '#7a8a6a' },
  ],

  ammoPickups: [
    { position: [0, 0.5, -35], weaponType: 'rocket', amount: 3 },
    { position: [-12, 0, -84], weaponType: 'rocket', amount: 2 },
  ],

  boostPads: [
    { position: [8, 2.6, -65], direction: [0, 0, -1], speed: 450 },
  ],

  settings: {
    maxRocketAmmo: 5,
    maxGrenadeAmmo: 0,
    parTime: 90,
  },

  lighting: {
    ambientIntensity: 0.35,
    directionalIntensity: 1.4,
    directionalPosition: [40, 70, -20],
    directionalColor: '#ffeedd',
    hemisphereGround: '#4a3a2a',
    hemisphereSky: '#aaccee',
    hemisphereIntensity: 0.4,
    fogColor: '#a0c0d0',
    fogNear: 50,
    fogFar: 160,
  },

  backgroundColor: '#a0c0d0',
};
