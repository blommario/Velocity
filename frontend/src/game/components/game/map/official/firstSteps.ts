/**
 * First Steps — training facility map definition.
 * Concrete arena with scattered cover, step platforms, and ammo pickups.
 *
 * Depends on: ../types
 * Used by: gameStore (map registry)
 */
import type { MapData } from '../types';

const ARENA_SIZE = 50;
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
  models: [
    // ═══════════════════════════════════════
    // GROUND — GLB floor tiled 5×5 across 50×50 arena (~10 unit tiles)
    // ═══════════════════════════════════════
    ...([-20, -10, 0, 10, 20] as const).flatMap((x) =>
      ([-20, -10, 0, 10, 20] as const).map((z) => ({
        modelUrl: 'maps/floor.glb' as const,
        position: [x, 0, z] as [number, number, number],
        collider: 'trimesh' as const,
      })),
    ),
  ],
  blocks: [

    // ═══════════════════════════════════════
    // BOUNDARY WALLS — thick concrete perimeter
    // ═══════════════════════════════════════
    { shape: 'box', position: [0, WALL_HEIGHT / 2, -HALF], size: [ARENA_SIZE, WALL_HEIGHT, 2], color: '#606060' },
    { shape: 'box', position: [0, WALL_HEIGHT / 2, HALF], size: [ARENA_SIZE, WALL_HEIGHT, 2], color: '#606060' },
    { shape: 'box', position: [-HALF, WALL_HEIGHT / 2, 0], size: [2, WALL_HEIGHT, ARENA_SIZE], color: '#606060' },
    { shape: 'box', position: [HALF, WALL_HEIGHT / 2, 0], size: [2, WALL_HEIGHT, ARENA_SIZE], color: '#606060' },

    // Invisible barriers above walls
    { shape: 'box', position: [0, WALL_HEIGHT + BARRIER_HEIGHT / 2, -HALF], size: [ARENA_SIZE, BARRIER_HEIGHT, 1], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [0, WALL_HEIGHT + BARRIER_HEIGHT / 2, HALF], size: [ARENA_SIZE, BARRIER_HEIGHT, 1], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [-HALF, WALL_HEIGHT + BARRIER_HEIGHT / 2, 0], size: [1, BARRIER_HEIGHT, ARENA_SIZE], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [HALF, WALL_HEIGHT + BARRIER_HEIGHT / 2, 0], size: [1, BARRIER_HEIGHT, ARENA_SIZE], color: '#000000', transparent: true, opacity: 0 },

    // ═══════════════════════════════════════
    // SCATTERED COVER — concrete blocks
    // ═══════════════════════════════════════
    { shape: 'box', position: [6, 1.5, -8], size: [3, 3, 3], color: '#6b6b6b' },
    { shape: 'box', position: [-8, 1, -5], size: [2, 2, 2], color: '#707070' },
    { shape: 'box', position: [-6, 1.5, -14], size: [3, 3, 3], color: '#686868' },
    { shape: 'box', position: [12, 1, -4], size: [2, 2, 2], color: '#757575' },
    { shape: 'box', position: [4, 2, -18], size: [4, 4, 4], color: '#626262' },
    { shape: 'box', position: [-14, 2, -20], size: [4, 4, 4], color: '#585858' },
    { shape: 'box', position: [16, 1.5, -15], size: [3, 3, 3], color: '#6e6e6e' },
    { shape: 'box', position: [-18, 1, -10], size: [2, 2, 6], color: '#646464' },

    // ═══════════════════════════════════════
    // WALLS — metal panel strafe walls
    // ═══════════════════════════════════════
    { shape: 'box', position: [-4, 1.5, -12], size: [8, 3, 0.6], color: '#4a5560' },
    { shape: 'box', position: [18, 1.5, -18], size: [0.6, 3, 10], color: '#4a5560' },

    // ═══════════════════════════════════════
    // STEP PLATFORMS — solid metal panels
    // ═══════════════════════════════════════
    { shape: 'box', position: [10, 0.5, -10], size: [6, 1, 6], color: '#556677' },
    { shape: 'box', position: [12, 1.5, -12], size: [4, 1, 4], color: '#556677' },
    { shape: 'box', position: [-20, 0.5, -16], size: [6, 1, 6], color: '#556677' },
    { shape: 'box', position: [-20, 1.5, -18], size: [4, 1, 4], color: '#556677' },

  ],

  checkpoints: [
    { position: [4, 3, -18], size: [6, 6, 3], index: 0 },
  ],

  finish: {
    position: [0, 4, -22],
    size: [8, 6, 3],
  },

  killZones: [
    { position: [0, -20, 0], size: [200, 5, 200] },
  ],

  ammoPickups: [
    { position: [4, 1, -4], weaponType: 'rocket', amount: 3 },
    { position: [-4, 1, -4], weaponType: 'grenade', amount: 2 },
    { position: [16, 1, -15], weaponType: 'rocket', amount: 2, respawnTime: 10 },
    { position: [-14, 1, -20], weaponType: 'grenade', amount: 2, respawnTime: 10 },
  ],

  settings: {
    maxRocketAmmo: 10,
    maxGrenadeAmmo: 3,
    parTime: 30,
  },

  lighting: {
    ambientIntensity: 0.8,
    ambientColor: '#ffffff',
    directionalIntensity: 1.2,
    directionalColor: '#ffffff',
    directionalPosition: [50, 80, 30],
    hemisphereGround: '#888888',
    hemisphereSky: '#ffffff',
    hemisphereIntensity: 0.3,
    fogColor: '#cccccc',
    fogNear: 80,
    fogFar: 200,
  },

  skybox: 'day',
  backgroundColor: '#cccccc',
};
