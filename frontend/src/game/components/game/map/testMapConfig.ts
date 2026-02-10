/**
 * Layout data for the test/dev map — spawn, grid, pillars, sector markers,
 * material demo blocks. Pure data, no React components.
 *
 * Depends on: MapBlock type
 * Used by: TestMap
 */
import type { MapBlock } from './types';

export const TOTAL_CHECKPOINTS = 3;
export const SPAWN_POINT: [number, number, number] = [0, 2, 0];
export const SPAWN_YAW = 0;

export const GRID = {
  SIZE: 200,
  DIVISIONS: 40,
  LINE_MAIN: '#555555',
  LINE_SUB: '#333333',
} as const;

export const BACKGROUND_COLOR = '#1a1a2e';

export const PILLAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#2980b9',
] as const;

export const SECTOR_MARKERS: Array<{
  position: [number, number, number];
  color: string;
  label: string;
}> = [
  { position: [0, 0, 0], color: '#ffffff', label: 'Origin' },
  { position: [40, 0, 0], color: '#e74c3c', label: '+X' },
  { position: [-40, 0, 0], color: '#c0392b', label: '-X' },
  { position: [0, 0, -40], color: '#3498db', label: '-Z' },
  { position: [0, 0, 40], color: '#2980b9', label: '+Z' },
];

export const MATERIAL_DEMO_BLOCKS: MapBlock[] = [
  { shape: 'box', position: [-30, -0.25, 10], size: [10, 0.5, 10], color: '#888888', proceduralMaterial: 'concrete', textureScale: [0.5, 0.5] },
  { shape: 'box', position: [-30, 2.5, 15.25], size: [10, 5, 0.5], color: '#aaaacc', proceduralMaterial: 'metal', textureScale: [2, 2] },
  { shape: 'box', position: [-30, 2.5, 4.75], size: [10, 5, 0.5], color: '#4488aa', proceduralMaterial: 'scifi-panel', textureScale: [1, 1] },
  { shape: 'box', position: [-30, 5.25, 10], size: [10, 0.3, 0.3], color: '#00ff88', proceduralMaterial: 'neon', emissive: '#00ff88', emissiveIntensity: 4.0, emissiveAnimation: 'pulse', emissiveAnimationSpeed: 1.5 },
  { shape: 'box', position: [-35.25, 1.5, 10], size: [0.5, 3, 10], color: '#887766', proceduralMaterial: 'rust', textureScale: [1, 1] },
  { shape: 'box', position: [-30, -0.25, 22], size: [10, 0.5, 4], color: '#cc9966', proceduralMaterial: 'tile', textureScale: [2, 2] },
  { shape: 'box', position: [-24.5, 4, 10], size: [1, 8, 1], color: '#888888', proceduralMaterial: 'concrete', blendProceduralMaterial: 'rust', blendMode: 'height', blendHeight: 4, blendSharpness: 2, textureScale: [1, 1] },
  { shape: 'box', position: [-30, 0.15, 15.5], size: [10, 0.15, 0.15], color: '#ff3300', proceduralMaterial: 'neon', emissive: '#ff3300', emissiveIntensity: 3.0, emissiveAnimation: 'flicker', emissiveAnimationSpeed: 2.0 },
];

export const LIGHT_SPRITES = [
  { position: [50.5, 1, -15] as [number, number, number], color: '#00ff88', size: 3.0 },
  { position: [10, 1, 15] as [number, number, number], color: '#ff6600', size: 3.0 },
  { position: [20, 4, -10] as [number, number, number], color: '#00ccff', size: 2.0 },
  { position: [5, 1.5, -8] as [number, number, number], color: '#ef4444', size: 2.0 },
  { position: [30, 1.5, 5] as [number, number, number], color: '#22c55e', size: 2.0 },
  { position: [-15, 15, -15] as [number, number, number], color: '#a78bfa', size: 3.0 },
  { position: [40, 13, -10] as [number, number, number], color: '#a78bfa', size: 3.0 },
];
