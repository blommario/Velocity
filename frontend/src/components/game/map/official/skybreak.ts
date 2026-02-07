import type { MapData } from '../types';

/** Skybreak — Expert. Floating islands, grapple + surf + extreme rockets. Par: 180s */
export const SKYBREAK: MapData = {
  spawnPoint: [0, 52, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Starting island — metal panel texture
    { shape: 'box', position: [0, 50, 0], size: [14, 2, 14], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [2, 2] },
    // Raised edges — mesh texture
    { shape: 'box', position: [-6, 51.5, 0], size: [1, 1, 14], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 4] },
    { shape: 'box', position: [6, 51.5, 0], size: [1, 1, 14], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 4] },

    // Bridge to island 2 — grill texture
    { shape: 'box', position: [0, 50, -14], size: [2, 0.5, 14], color: '#6688aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 4] },

    // Island 2 — metal panel
    { shape: 'box', position: [0, 49, -28], size: [12, 2, 12], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [2, 2] },

    // Island 3
    { shape: 'box', position: [20, 48, -28], size: [10, 2, 10], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [2, 2] },

    // Stepping stones
    { shape: 'box', position: [28, 50, -35], size: [3, 0.5, 3], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [33, 52, -42], size: [3, 0.5, 3], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [28, 54, -49], size: [3, 0.5, 3], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },

    // Island 4 — grapple hub
    { shape: 'box', position: [20, 55, -56], size: [14, 2, 14], color: '#5577aa', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [2, 2] },

    // Tall pillar
    { shape: 'box', position: [20, 68, -56], size: [2, 24, 2], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 8] },

    // Island 5
    { shape: 'box', position: [-10, 58, -70], size: [12, 2, 12], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [2, 2] },

    // Island 6 — low, large
    { shape: 'box', position: [-10, 40, -100], size: [16, 2, 16], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 3] },

    // Vertical walls for wall running
    { shape: 'box', position: [-19, 48, -100], size: [1, 18, 16], color: '#446688', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 4] },
    { shape: 'box', position: [-1, 48, -100], size: [1, 18, 16], color: '#446688', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 4] },

    // Upper ledge
    { shape: 'box', position: [-10, 56, -108], size: [8, 1, 4], color: '#5577aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 1] },

    // Bridge to island 7
    { shape: 'box', position: [-10, 55.5, -118], size: [3, 0.5, 16], color: '#6688aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 4] },

    // Island 7
    { shape: 'box', position: [-10, 55, -130], size: [10, 2, 10], color: '#5577aa', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [2, 2] },

    // Final sky bridge
    { shape: 'box', position: [5, 60, -140], size: [1.5, 0.5, 24], color: '#7799bb', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 6] },

    // Island 8
    { shape: 'box', position: [20, 62, -150], size: [10, 2, 10], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [2, 2] },

    // Final island
    { shape: 'box', position: [20, 64, -170], size: [16, 2, 14], color: '#5588bb', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [3, 2] },
    // Victory platform accent
    { shape: 'box', position: [20, 65.02, -170], size: [14, 0.05, 12], color: '#88bbff', emissive: '#88bbff', emissiveIntensity: 0.5, transparent: true, opacity: 0.3 },
  ],

  checkpoints: [
    { position: [0, 52, -28], size: [8, 5, 3], index: 0 },
    { position: [20, 58, -56], size: [8, 5, 3], index: 1 },
    { position: [-10, 43, -100], size: [10, 5, 3], index: 2 },
    { position: [-10, 58, -130], size: [8, 5, 3], index: 3 },
    { position: [20, 65, -150], size: [8, 5, 3], index: 4 },
  ],

  finish: {
    position: [20, 67, -173],
    size: [14, 5, 3],
  },

  killZones: [
    { position: [0, 20, -90], size: [300, 5, 300] },
  ],

  surfRamps: [
    // Surf descent from island 5 to island 6
    { position: [-14, 50, -82], size: [10, 0.3, 20], rotation: [0.2, 0, 0.55], color: '#6688aa' },
    { position: [-6, 50, -82], size: [10, 0.3, 20], rotation: [0.2, 0, -0.55], color: '#6688aa' },
  ],

  grapplePoints: [
    { position: [20, 72, -56] },    // Top of pillar on island 4
    { position: [-10, 65, -65] },    // Between island 4 and 5
    { position: [10, 64, -145] },    // Between sky bridge and island 8
    { position: [20, 70, -160] },    // Approach to final island
  ],

  launchPads: [
    { position: [-10, 55.2, -127], direction: [0.3, 0.8, -0.5], speed: 700, color: '#4488ff' },
  ],

  boostPads: [
    { position: [0, 50.1, -7], direction: [0, 0, -1], speed: 400, color: '#88bbff' },
  ],

  speedGates: [
    { position: [5, 61, -130], size: [4, 4, 1], color: '#88bbff' },
  ],

  ammoPickups: [
    { position: [0, 52, -25], weaponType: 'rocket', amount: 3 },
    { position: [20, 58, -53], weaponType: 'rocket', amount: 3 },
    { position: [-10, 43, -97], weaponType: 'rocket', amount: 2 },
    { position: [-10, 58, -133], weaponType: 'grenade', amount: 2 },
  ],

  settings: {
    maxRocketAmmo: 5,
    maxGrenadeAmmo: 3,
    parTime: 180,
  },

  lighting: {
    ambientIntensity: 0.6,
    ambientColor: '#aaddff',
    directionalIntensity: 1.5,
    directionalColor: '#ffffff',
    directionalPosition: [60, 100, -40],
    hemisphereGround: '#446688',
    hemisphereSky: '#bbddff',
    hemisphereIntensity: 0.5,
    fogColor: '#88bbee',
    fogNear: 80,
    fogFar: 250,
  },

  skybox: 'hdri:satara_night_2k.hdr',
  backgroundColor: '#88bbee',
};
