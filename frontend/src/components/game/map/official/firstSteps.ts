import type { MapData } from '../types';

const ARENA_SIZE = 200;
const WALL_HEIGHT = 8;
const BARRIER_HEIGHT = 80; // invisible barrier extends far above visible walls
const HALF = ARENA_SIZE / 2;

/** First Steps — Simple playground. Large arena with cubes to run around. */
export const FIRST_STEPS: MapData = {
  spawnPoint: [0, 1.5, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // ── Ground ──
    { shape: 'box', position: [0, -0.5, 0], size: [ARENA_SIZE, 1, ARENA_SIZE], color: '#3a3a3a' },

    // ── Boundary walls (visible portion) ──
    { shape: 'box', position: [0, WALL_HEIGHT / 2, -HALF], size: [ARENA_SIZE, WALL_HEIGHT, 1], color: '#2a2a3a' },
    { shape: 'box', position: [0, WALL_HEIGHT / 2, HALF], size: [ARENA_SIZE, WALL_HEIGHT, 1], color: '#2a2a3a' },
    { shape: 'box', position: [-HALF, WALL_HEIGHT / 2, 0], size: [1, WALL_HEIGHT, ARENA_SIZE], color: '#2a2a3a' },
    { shape: 'box', position: [HALF, WALL_HEIGHT / 2, 0], size: [1, WALL_HEIGHT, ARENA_SIZE], color: '#2a2a3a' },

    // ── Invisible barriers (extend high above visible walls) ──
    { shape: 'box', position: [0, WALL_HEIGHT + BARRIER_HEIGHT / 2, -HALF], size: [ARENA_SIZE, BARRIER_HEIGHT, 1], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [0, WALL_HEIGHT + BARRIER_HEIGHT / 2, HALF], size: [ARENA_SIZE, BARRIER_HEIGHT, 1], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [-HALF, WALL_HEIGHT + BARRIER_HEIGHT / 2, 0], size: [1, BARRIER_HEIGHT, ARENA_SIZE], color: '#000000', transparent: true, opacity: 0 },
    { shape: 'box', position: [HALF, WALL_HEIGHT + BARRIER_HEIGHT / 2, 0], size: [1, BARRIER_HEIGHT, ARENA_SIZE], color: '#000000', transparent: true, opacity: 0 },

    // ── Scattered cubes near spawn (close range) ──
    { shape: 'box', position: [8, 1.5, -10], size: [3, 3, 3], color: '#e74c3c' },
    { shape: 'box', position: [-12, 1, -6], size: [2, 2, 2], color: '#3498db' },
    { shape: 'box', position: [-8, 1.5, -18], size: [3, 3, 3], color: '#f39c12' },
    { shape: 'box', position: [18, 1, -5], size: [2, 2, 2], color: '#9b59b6' },

    // ── Medium distance obstacles ──
    { shape: 'box', position: [5, 2, -35], size: [4, 4, 4], color: '#2ecc71' },
    { shape: 'box', position: [-20, 2, -40], size: [4, 4, 4], color: '#1abc9c' },
    { shape: 'box', position: [25, 1.5, -30], size: [3, 3, 3], color: '#2980b9' },
    { shape: 'box', position: [-30, 1, -20], size: [2, 2, 8], color: '#e67e22' },
    { shape: 'box', position: [35, 2, -45], size: [4, 4, 4], color: '#e74c3c' },

    // ── Far obstacles (for speed runs) ──
    { shape: 'box', position: [0, 2.5, -70], size: [5, 5, 5], color: '#8e44ad' },
    { shape: 'box', position: [-40, 1.5, -60], size: [3, 3, 3], color: '#d35400' },
    { shape: 'box', position: [50, 2, -55], size: [4, 4, 4], color: '#16a085' },
    { shape: 'box', position: [-55, 1, -75], size: [2, 2, 2], color: '#c0392b' },
    { shape: 'box', position: [30, 3, -80], size: [6, 6, 6], color: '#2c3e50' },

    // ── Walls to strafe around ──
    { shape: 'box', position: [-5, 1.5, -15], size: [12, 3, 0.5], color: '#555555' },
    { shape: 'box', position: [40, 1.5, -35], size: [0.5, 3, 15], color: '#555555' },
    { shape: 'box', position: [-35, 1.5, -50], size: [20, 3, 0.5], color: '#555555' },

    // ── Step platforms (varied heights) ──
    { shape: 'box', position: [12, 0.5, -15], size: [6, 1, 6], color: '#4a4a5a' },
    { shape: 'box', position: [15, 1.5, -18], size: [4, 1, 4], color: '#5a5a6a' },
    { shape: 'box', position: [-45, 0.5, -30], size: [8, 1, 8], color: '#4a5a4a' },
    { shape: 'box', position: [-45, 1.5, -33], size: [4, 1, 4], color: '#5a6a5a' },
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
    // Near spawn — immediate access
    { position: [4, 1, -4], weaponType: 'rocket', amount: 3 },
    { position: [-4, 1, -4], weaponType: 'grenade', amount: 2 },
    // Mid-range
    { position: [25, 1, -30], weaponType: 'rocket', amount: 2, respawnTime: 10 },
    { position: [-20, 1, -40], weaponType: 'grenade', amount: 2, respawnTime: 10 },
    // Far
    { position: [0, 1, -65], weaponType: 'rocket', amount: 3, respawnTime: 15 },
  ],

  settings: {
    maxRocketAmmo: 5,
    maxGrenadeAmmo: 3,
    parTime: 30,
  },

  lighting: {
    ambientIntensity: 0.6,
    directionalIntensity: 1.2,
    directionalPosition: [50, 80, 30],
    fogColor: '#1a1a2e',
    fogNear: 120,
    fogFar: 350,
  },

  backgroundColor: '#1a1a2e',
};
