import type { MapData } from '../types';

const ARENA_SIZE = 200;
const WALL_HEIGHT = 8;
const BARRIER_HEIGHT = 80;
const HALF = ARENA_SIZE / 2;

/**
 * First Steps — Training facility. Concrete & metal compound with
 * scattered cover, corridors, and step platforms. Bright daylight.
 */
export const FIRST_STEPS: MapData = {
  spawnPoint: [0, 1.5, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // ═══════════════════════════════════════
    // GROUND — large concrete slab
    // ═══════════════════════════════════════
    { shape: 'box', position: [0, -0.5, 0], size: [ARENA_SIZE, 1, ARENA_SIZE], color: '#5a5a5a', textureSet: 'concrete-034', textureScale: [25, 25] },

    // ═══════════════════════════════════════
    // BOUNDARY WALLS — thick concrete perimeter
    // ═══════════════════════════════════════
    { shape: 'box', position: [0, WALL_HEIGHT / 2, -HALF], size: [ARENA_SIZE, WALL_HEIGHT, 2], color: '#606060', textureSet: 'concrete-034', textureScale: [25, 2] },
    { shape: 'box', position: [0, WALL_HEIGHT / 2, HALF], size: [ARENA_SIZE, WALL_HEIGHT, 2], color: '#606060', textureSet: 'concrete-034', textureScale: [25, 2] },
    { shape: 'box', position: [-HALF, WALL_HEIGHT / 2, 0], size: [2, WALL_HEIGHT, ARENA_SIZE], color: '#606060', textureSet: 'concrete-034', textureScale: [2, 25] },
    { shape: 'box', position: [HALF, WALL_HEIGHT / 2, 0], size: [2, WALL_HEIGHT, ARENA_SIZE], color: '#606060', textureSet: 'concrete-034', textureScale: [2, 25] },

    // Metal trim along wall tops
    { shape: 'box', position: [0, WALL_HEIGHT + 0.15, -HALF], size: [ARENA_SIZE, 0.3, 2.4], color: '#4a5560', textureSet: 'metal-009', textureScale: [25, 1] },
    { shape: 'box', position: [0, WALL_HEIGHT + 0.15, HALF], size: [ARENA_SIZE, 0.3, 2.4], color: '#4a5560', textureSet: 'metal-009', textureScale: [25, 1] },
    { shape: 'box', position: [-HALF, WALL_HEIGHT + 0.15, 0], size: [2.4, 0.3, ARENA_SIZE], color: '#4a5560', textureSet: 'metal-009', textureScale: [1, 25] },
    { shape: 'box', position: [HALF, WALL_HEIGHT + 0.15, 0], size: [2.4, 0.3, ARENA_SIZE], color: '#4a5560', textureSet: 'metal-009', textureScale: [1, 25] },

    // Invisible barriers above walls
    { shape: 'box', position: [0, WALL_HEIGHT + BARRIER_HEIGHT / 2, -HALF], size: [ARENA_SIZE, BARRIER_HEIGHT, 1], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [0, WALL_HEIGHT + BARRIER_HEIGHT / 2, HALF], size: [ARENA_SIZE, BARRIER_HEIGHT, 1], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [-HALF, WALL_HEIGHT + BARRIER_HEIGHT / 2, 0], size: [1, BARRIER_HEIGHT, ARENA_SIZE], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [HALF, WALL_HEIGHT + BARRIER_HEIGHT / 2, 0], size: [1, BARRIER_HEIGHT, ARENA_SIZE], color: '#000000', transparent: true, opacity: 0 },

    // ═══════════════════════════════════════
    // SPAWN AREA — raised metal pad
    // ═══════════════════════════════════════
    { shape: 'box', position: [0, 0.05, 0], size: [6, 0.1, 6], color: '#556677', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [1, 1] },

    // ═══════════════════════════════════════
    // SCATTERED COVER — concrete blocks, no glow
    // ═══════════════════════════════════════
    // Near spawn
    { shape: 'box', position: [8, 1.5, -10], size: [3, 3, 3], color: '#6b6b6b', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [-12, 1, -6], size: [2, 2, 2], color: '#707070', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [-8, 1.5, -18], size: [3, 3, 3], color: '#686868', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [18, 1, -5], size: [2, 2, 2], color: '#757575', textureSet: 'concrete-034', textureScale: [1, 1] },

    // Medium distance — larger concrete obstacles
    { shape: 'box', position: [5, 2, -35], size: [4, 4, 4], color: '#626262', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [-20, 2, -40], size: [4, 4, 4], color: '#585858', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [25, 1.5, -30], size: [3, 3, 3], color: '#6e6e6e', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [-30, 1, -20], size: [2, 2, 8], color: '#646464', textureSet: 'concrete-034', textureScale: [1, 2] },
    { shape: 'box', position: [35, 2, -45], size: [4, 4, 4], color: '#5e5e5e', textureSet: 'concrete-034', textureScale: [1, 1] },

    // Far obstacles
    { shape: 'box', position: [0, 2.5, -70], size: [5, 5, 5], color: '#555555', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [-40, 1.5, -60], size: [3, 3, 3], color: '#6a6a6a', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [50, 2, -55], size: [4, 4, 4], color: '#606060', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [-55, 1, -75], size: [2, 2, 2], color: '#727272', textureSet: 'concrete-034', textureScale: [1, 1] },
    { shape: 'box', position: [30, 3, -80], size: [6, 6, 6], color: '#4e4e4e', textureSet: 'concrete-034', textureScale: [2, 2] },

    // ═══════════════════════════════════════
    // WALLS — metal panel strafe walls
    // ═══════════════════════════════════════
    { shape: 'box', position: [-5, 1.5, -15], size: [12, 3, 0.6], color: '#4a5560', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 1] },
    { shape: 'box', position: [40, 1.5, -35], size: [0.6, 3, 15], color: '#4a5560', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [1, 3] },
    { shape: 'box', position: [-35, 1.5, -50], size: [20, 3, 0.6], color: '#4a5560', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 1] },

    // ═══════════════════════════════════════
    // STEP PLATFORMS — solid metal panels
    // ═══════════════════════════════════════
    { shape: 'box', position: [12, 0.5, -15], size: [6, 1, 6], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [2, 2] },
    { shape: 'box', position: [15, 1.5, -18], size: [4, 1, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [-45, 0.5, -30], size: [8, 1, 8], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [2, 2] },
    { shape: 'box', position: [-45, 1.5, -33], size: [4, 1, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },

    // ═══════════════════════════════════════
    // FLOOR DETAILS — concrete seam lines
    // ═══════════════════════════════════════
    { shape: 'box', position: [0, 0.005, -25], size: [80, 0.01, 0.08], color: '#3a3a3a' },
    { shape: 'box', position: [0, 0.005, -50], size: [100, 0.01, 0.08], color: '#3a3a3a' },
    { shape: 'box', position: [0, 0.005, -75], size: [100, 0.01, 0.08], color: '#3a3a3a' },
    { shape: 'box', position: [-25, 0.005, -40], size: [0.08, 0.01, 80], color: '#3a3a3a' },
    { shape: 'box', position: [25, 0.005, -40], size: [0.08, 0.01, 80], color: '#3a3a3a' },

    // ═══════════════════════════════════════
    // PERIMETER DETAIL — wall-mounted metal panels
    // ═══════════════════════════════════════
    { shape: 'box', position: [-HALF + 1.2, 3, -30], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [-HALF + 1.2, 3, -60], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [HALF - 1.2, 3, -30], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [HALF - 1.2, 3, -60], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
  ],

  checkpoints: [
    { position: [5, 3, -35], size: [6, 6, 3], index: 0 },
    { position: [0, 4, -70], size: [8, 6, 3], index: 1 },
  ],

  finish: {
    position: [30, 4, -82],
    size: [8, 6, 3],
  },

  killZones: [
    { position: [0, -20, 0], size: [400, 5, 400] },
  ],

  ammoPickups: [
    { position: [4, 1, -4], weaponType: 'rocket', amount: 3 },
    { position: [-4, 1, -4], weaponType: 'grenade', amount: 2 },
    { position: [25, 1, -30], weaponType: 'rocket', amount: 2, respawnTime: 10 },
    { position: [-20, 1, -40], weaponType: 'grenade', amount: 2, respawnTime: 10 },
    { position: [0, 1, -65], weaponType: 'rocket', amount: 3, respawnTime: 15 },
  ],

  settings: {
    maxRocketAmmo: 10,
    maxGrenadeAmmo: 3,
    parTime: 30,
  },

  lighting: {
    ambientIntensity: 0.5,
    ambientColor: '#ddeeff',
    directionalIntensity: 1.6,
    directionalColor: '#fff5e0',
    directionalPosition: [60, 100, 40],
    hemisphereGround: '#5a5040',
    hemisphereSky: '#c8ddf0',
    hemisphereIntensity: 0.4,
    fogColor: '#b0c4d8',
    fogNear: 100,
    fogFar: 300,
  },

  skybox: 'day',
  backgroundColor: '#b0c4d8',
};
