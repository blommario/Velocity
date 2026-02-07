import type { MapData } from '../types';

/** Skybreak — Expert. Floating islands, grapple + surf + extreme rockets. Par: 180s */
export const SKYBREAK: MapData = {
  spawnPoint: [0, 52, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Starting island — metal panel texture (1000x1000 landing pad)
    { shape: 'box', position: [0, 50, 0], size: [1000, 2, 1000], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [120, 120] },
    // Raised edges — mesh texture
    { shape: 'box', position: [-499, 51.5, 0], size: [1, 2, 1000], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 240] },
    { shape: 'box', position: [499, 51.5, 0], size: [1, 2, 1000], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 240] },
    { shape: 'box', position: [0, 51.5, 499], size: [1000, 2, 1], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [240, 1] },
    { shape: 'box', position: [0, 51.5, -499], size: [1000, 2, 1], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [240, 1] },

    // Bridge to island 2 — grill texture (wider)
    { shape: 'box', position: [0, 50, -22], size: [6, 0.5, 14], color: '#6688aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 4] },

    // Island 2 — metal panel (bigger)
    { shape: 'box', position: [0, 49, -38], size: [24, 2, 20], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [3, 3] },

    // Island 3 (bigger)
    { shape: 'box', position: [22, 48, -38], size: [18, 2, 18], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 3] },

    // Stepping stones (bigger — 6x6 instead of 3x3)
    { shape: 'box', position: [30, 50, -48], size: [7, 0.5, 7], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [36, 52, -56], size: [7, 0.5, 7], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [30, 54, -64], size: [7, 0.5, 7], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },

    // Island 4 — grapple hub (bigger)
    { shape: 'box', position: [20, 55, -74], size: [26, 2, 26], color: '#5577aa', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 4] },

    // Tall pillar
    { shape: 'box', position: [20, 68, -74], size: [3, 24, 3], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 8] },

    // Island 5 (bigger)
    { shape: 'box', position: [-10, 58, -92], size: [22, 2, 22], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [3, 3] },

    // Island 6 — low, large (even larger)
    { shape: 'box', position: [-10, 40, -124], size: [28, 2, 28], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [4, 4] },

    // Vertical walls for wall running (taller, wider gap)
    { shape: 'box', position: [-25, 48, -124], size: [1, 18, 28], color: '#446688', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [6, 4] },
    { shape: 'box', position: [5, 48, -124], size: [1, 18, 28], color: '#446688', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [6, 4] },

    // Upper ledge (wider)
    { shape: 'box', position: [-10, 56, -138], size: [14, 1, 6], color: '#5577aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [3, 1] },

    // Bridge to island 7 (wider)
    { shape: 'box', position: [-10, 55.5, -150], size: [6, 0.5, 18], color: '#6688aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 5] },

    // Island 7 (bigger)
    { shape: 'box', position: [-10, 55, -166], size: [20, 2, 20], color: '#5577aa', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [3, 3] },

    // Final sky bridge (wider)
    { shape: 'box', position: [5, 60, -180], size: [5, 0.5, 30], color: '#7799bb', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 8] },

    // Island 8 (bigger)
    { shape: 'box', position: [22, 62, -196], size: [20, 2, 20], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 3] },

    // Final island (bigger)
    { shape: 'box', position: [22, 64, -220], size: [30, 2, 24], color: '#5588bb', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [4, 3] },
    // Victory platform accent
    { shape: 'box', position: [22, 65.02, -220], size: [26, 0.05, 20], color: '#88bbff', emissive: '#88bbff', emissiveIntensity: 0.5, transparent: true, opacity: 0.3 },
  ],

  checkpoints: [
    { position: [0, 52, -38], size: [12, 5, 3], index: 0 },
    { position: [20, 58, -74], size: [12, 5, 3], index: 1 },
    { position: [-10, 43, -124], size: [14, 5, 3], index: 2 },
    { position: [-10, 58, -166], size: [12, 5, 3], index: 3 },
    { position: [22, 65, -196], size: [12, 5, 3], index: 4 },
  ],

  finish: {
    position: [22, 67, -225],
    size: [20, 5, 3],
  },

  killZones: [
    { position: [0, 10, -110], size: [500, 5, 500] },
  ],

  surfRamps: [
    // Surf descent from island 5 to island 6
    { position: [-16, 50, -106], size: [12, 0.3, 24], rotation: [0.2, 0, 0.55], color: '#6688aa' },
    { position: [-4, 50, -106], size: [12, 0.3, 24], rotation: [0.2, 0, -0.55], color: '#6688aa' },
  ],

  grapplePoints: [
    { position: [20, 72, -74] },    // Top of pillar on island 4
    { position: [-10, 65, -84] },    // Between island 4 and 5
    { position: [10, 64, -188] },    // Between sky bridge and island 8
    { position: [22, 70, -208] },    // Approach to final island
  ],

  launchPads: [
    { position: [-10, 55.2, -163], direction: [0.3, 0.8, -0.5], speed: 700, color: '#4488ff' },
  ],

  boostPads: [
    { position: [0, 50.1, -7], direction: [0, 0, -1], speed: 400, color: '#88bbff' },
  ],

  speedGates: [
    { position: [5, 61, -166], size: [6, 6, 1], color: '#88bbff' },
  ],

  ammoPickups: [
    { position: [0, 52, -35], weaponType: 'rocket', amount: 3 },
    { position: [20, 58, -71], weaponType: 'rocket', amount: 3 },
    { position: [-10, 43, -121], weaponType: 'rocket', amount: 2 },
    { position: [-10, 58, -169], weaponType: 'grenade', amount: 2 },
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
