/**
 * Hill Run — heightmap terrain map with a Gaussian hill obstacle.
 * Tests slope physics: uphill slows, downhill accelerates.
 *
 * Depends on: ../types
 * Used by: gameStore (map registry)
 */
import type { MapData } from '../types';

/**
 * Generate a smooth Gaussian hill heightmap.
 * 33x33 grid covering 64x64 world units, peak ~10 units at center.
 */
function generateHillHeights(): number[][] {
  const size = 33;
  const heights: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      const nx = (c / (size - 1)) * 2 - 1;
      const nz = (r / (size - 1)) * 2 - 1;
      const dist = nx * nx + nz * nz;
      const height = 10 * Math.exp(-dist * 2.0);
      row.push(height);
    }
    heights.push(row);
  }
  return heights;
}

const HILL_HEIGHTS = generateHillHeights();

/**
 * Hill Run — Run up and over a smooth hill.
 * Slope physics makes uphill slower and downhill faster.
 * Daylight outdoor environment with grass terrain.
 */
export const HILL_RUN: MapData = {
  spawnPoint: [-40, 2, 0],
  spawnDirection: [1, 0, 0],
  blocks: [
    // Ground plane (below terrain)
    { shape: 'box', position: [0, -1.5, 0], size: [160, 2, 80], color: '#3a4a2a' },

    // Flat start runway
    { shape: 'box', position: [-45, -0.15, 0], size: [30, 0.3, 14], color: '#555566', proceduralMaterial: 'concrete' },

    // Flat end runway
    { shape: 'box', position: [45, -0.15, 0], size: [30, 0.3, 14], color: '#555566', proceduralMaterial: 'concrete' },

    // Start arch left pillar
    { shape: 'box', position: [-33, 3, -4], size: [0.6, 6, 0.6], color: '#00ff88', emissive: '#00ff88', emissiveIntensity: 0.5 },
    // Start arch right pillar
    { shape: 'box', position: [-33, 3, 4], size: [0.6, 6, 0.6], color: '#00ff88', emissive: '#00ff88', emissiveIntensity: 0.5 },
    // Start arch top
    { shape: 'box', position: [-33, 6.3, 0], size: [0.6, 0.6, 9], color: '#00ff88', emissive: '#00ff88', emissiveIntensity: 0.8 },

    // Finish arch left pillar
    { shape: 'box', position: [50, 3, -4], size: [0.6, 6, 0.6], color: '#ff4444', emissive: '#ff4444', emissiveIntensity: 0.5 },
    // Finish arch right pillar
    { shape: 'box', position: [50, 3, 4], size: [0.6, 6, 0.6], color: '#ff4444', emissive: '#ff4444', emissiveIntensity: 0.5 },
    // Finish arch top
    { shape: 'box', position: [50, 6.3, 0], size: [0.6, 0.6, 9], color: '#ff4444', emissive: '#ff4444', emissiveIntensity: 0.8 },

    // Side walls (prevent running around the hill)
    { shape: 'box', position: [0, 5, -38], size: [160, 10, 2], color: '#404040', transparent: true, opacity: 0.15 },
    { shape: 'box', position: [0, 5, 38], size: [160, 10, 2], color: '#404040', transparent: true, opacity: 0.15 },
  ],

  checkpoints: [
    { position: [0, 11, 0], size: [8, 6, 8], index: 0 },   // Top of hill
    { position: [35, 2, 0], size: [6, 4, 8], index: 1 },    // After hill
  ],

  finish: {
    position: [52, 2, 0],
    size: [4, 4, 8],
  },

  killZones: [
    { position: [0, -10, 0], size: [200, 4, 100] },
  ],

  heightmapTerrains: [
    {
      position: [0, 0, 0],
      size: [64, 64],
      heights: HILL_HEIGHTS,
      color: '#5a7a3a',
      roughness: 0.9,
      metalness: 0.02,
    },
  ],

  skybox: 'day',

  lighting: {
    ambientIntensity: 0.5,
    directionalIntensity: 1.5,
    directionalPosition: [50, 80, 30],
    hemisphereGround: '#4a5a3a',
    hemisphereSky: '#87ceeb',
    hemisphereIntensity: 0.5,
    fogColor: '#b0c8e0',
    fogNear: 80,
    fogFar: 250,
  },

  backgroundColor: '#87ceeb',
};
