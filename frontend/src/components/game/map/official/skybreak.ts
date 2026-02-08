import type { MapData } from '../types';

/** Skybreak — Expert. Floating islands, grapple + surf + extreme rockets. Par: 180s */
export const SKYBREAK: MapData = {
  spawnPoint: [0, 9.9, -8],
  spawnDirection: [0, 0, -1],
  blocks: [
    // Starting island — metal panel texture (40x36 landing pad)
    // Top surface at Y=9, thick so player can't tunnel through
    { shape: 'box', position: [0, 5, -4], size: [40, 8, 36], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [5, 5] },
    // Raised edges — mesh texture
    { shape: 'box', position: [-19, 9.5, -4], size: [1, 2, 36], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 8] },
    { shape: 'box', position: [19, 9.5, -4], size: [1, 2, 36], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 8] },
    { shape: 'box', position: [0, 9.5, 13], size: [40, 2, 1], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [8, 1] },
    { shape: 'box', position: [0, 9.5, -21], size: [40, 2, 1], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [8, 1] },

    // Bridge to island 2 — grill texture (wider), top at Y=8.25
    { shape: 'box', position: [0, 6, -22], size: [6, 4, 14], color: '#6688aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 4] },

    // Island 2 — top at Y=8
    { shape: 'box', position: [0, 4, -38], size: [24, 8, 20], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [3, 3] },

    // Island 3 — top at Y=7
    { shape: 'box', position: [22, 3, -38], size: [18, 8, 18], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 3] },

    // Stepping stones — top at Y=8.25, 10.25, 12.25 (thicker: 4 units)
    { shape: 'box', position: [30, 6, -48], size: [7, 4, 7], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [36, 8, -56], size: [7, 4, 7], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [30, 10, -64], size: [7, 4, 7], color: '#7799bb', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },

    // Island 4 — grapple hub, top at Y=14
    { shape: 'box', position: [20, 10, -74], size: [26, 8, 26], color: '#5577aa', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 4] },

    // Tall pillar
    { shape: 'box', position: [20, 26, -74], size: [3, 24, 3], color: '#4466aa', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 8] },

    // Island 5 — top at Y=17
    { shape: 'box', position: [-10, 13, -92], size: [22, 8, 22], color: '#5577aa', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [3, 3] },

    // Island 6 — low, large, top at Y=-1 (thick: 8 units)
    { shape: 'box', position: [-10, -5, -124], size: [28, 8, 28], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [4, 4] },

    // Vertical walls for wall running (taller, wider gap)
    { shape: 'box', position: [-25, 6, -124], size: [1, 18, 28], color: '#446688', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [6, 4] },
    { shape: 'box', position: [5, 6, -124], size: [1, 18, 28], color: '#446688', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [6, 4] },

    // Upper ledge — top at Y=14.5 (thicker)
    { shape: 'box', position: [-10, 12, -138], size: [14, 4, 6], color: '#5577aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [3, 1] },

    // Bridge to island 7 — top at Y=13.75 (thicker)
    { shape: 'box', position: [-10, 11.5, -150], size: [6, 4, 18], color: '#6688aa', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 5] },

    // Island 7 — top at Y=14
    { shape: 'box', position: [-10, 10, -166], size: [20, 8, 20], color: '#5577aa', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [3, 3] },

    // Final sky bridge — top at Y=18.25 (thicker)
    { shape: 'box', position: [5, 16, -180], size: [5, 4, 30], color: '#7799bb', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 8] },

    // Island 8 — top at Y=21
    { shape: 'box', position: [22, 17, -196], size: [20, 8, 20], color: '#5577aa', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 3] },

    // Final island — top at Y=23
    { shape: 'box', position: [22, 19, -220], size: [30, 8, 24], color: '#5588bb', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [4, 3] },
    // Victory platform accent
    { shape: 'box', position: [22, 23.02, -220], size: [26, 0.05, 20], color: '#88bbff', emissive: '#88bbff', emissiveIntensity: 0.5, transparent: true, opacity: 0.3 },
  ],

  checkpoints: [
    { position: [0, 10, -38], size: [12, 5, 3], index: 0 },
    { position: [20, 16, -74], size: [12, 5, 3], index: 1 },
    { position: [-10, 1, -124], size: [14, 5, 3], index: 2 },
    { position: [-10, 16, -166], size: [12, 5, 3], index: 3 },
    { position: [22, 23, -196], size: [12, 5, 3], index: 4 },
  ],

  finish: {
    position: [22, 25, -225],
    size: [20, 5, 3],
  },

  killZones: [
    { position: [0, -32, -110], size: [500, 5, 500] },
  ],

  surfRamps: [
    // Surf descent from island 5 to island 6
    { position: [-16, 8, -106], size: [12, 0.3, 24], rotation: [0.2, 0, 0.55], color: '#6688aa' },
    { position: [-4, 8, -106], size: [12, 0.3, 24], rotation: [0.2, 0, -0.55], color: '#6688aa' },
  ],

  grapplePoints: [
    { position: [20, 30, -74] },    // Top of pillar on island 4
    { position: [-10, 23, -84] },    // Between island 4 and 5
    { position: [10, 22, -188] },    // Between sky bridge and island 8
    { position: [22, 28, -208] },    // Approach to final island
  ],

  launchPads: [
    { position: [-10, 13.2, -163], direction: [0.3, 0.8, -0.5], speed: 700, color: '#4488ff' },
  ],

  boostPads: [
    { position: [0, 8.1, -14], direction: [0, 0, -1], speed: 400, color: '#88bbff' },
  ],

  speedGates: [
    { position: [5, 19, -166], size: [6, 6, 1], color: '#88bbff' },
  ],

  ammoPickups: [
    { position: [0, 10, -35], weaponType: 'rocket', amount: 3 },
    { position: [20, 16, -71], weaponType: 'rocket', amount: 3 },
    { position: [-10, 1, -121], weaponType: 'rocket', amount: 2 },
    { position: [-10, 16, -169], weaponType: 'grenade', amount: 2 },
  ],

  settings: {
    maxRocketAmmo: 10,
    maxGrenadeAmmo: 3,
    parTime: 180,
  },

  lighting: {
    ambientIntensity: 0.6,
    ambientColor: '#aaddff',
    directionalIntensity: 1.5,
    directionalColor: '#ffffff',
    directionalPosition: [60, 58, -40],
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
