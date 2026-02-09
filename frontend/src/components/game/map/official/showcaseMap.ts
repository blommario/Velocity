import type { MapData, MapBlock, Vec3 } from '../types';

// ── Layout: 100x100 arena with labeled showcase zones ──
//
//  Spawn at center (0, 1.5, 0), facing -Z
//
//  Zone layout (roughly):
//
//    NW: Materials        N: Shapes           NE: Emissive Anims
//    W:  Water/Lava       CENTER: Spawn       E:  Particles
//    SW: Boost/Launch     S: Speed/Grapple    SE: Fog Volumes
//
//  Each zone has a label pedestal (emissive block with name written
//  as colored neon text-plate) so the builder can walk around and
//  see what each effect is.

const SIZE = 100;
const HALF = SIZE / 2;
const WALL_H = 6;

// ── Helpers ──

function labelPedestal(pos: Vec3, label: string, color: string): MapBlock[] {
  // Thin bright base plate + tall sign post + name plate
  // The name is conveyed via the block color/emissive — human reads the
  // position context.  We make each label zone visually distinct.
  return [
    // Ground marker (bright pad)
    { shape: 'box', position: [pos[0], 0.05, pos[2]], size: [6, 0.1, 6], color, emissive: color, emissiveIntensity: 1.5 },
    // Vertical post
    { shape: 'box', position: [pos[0], 2.5, pos[2] - 3.2], size: [0.2, 5, 0.2], color: '#aaaaaa' },
    // Sign plate (wide, thin)
    { shape: 'box', position: [pos[0], 5.2, pos[2] - 3.2], size: [6, 1, 0.15], color: '#111111', emissive: color, emissiveIntensity: 3.0 },
  ];
}

// ── 1. Materials Zone (NW: -30, 0, -30) ──

const MATERIALS_POS: Vec3 = [-30, 0, -30];

const MATERIAL_BLOCKS: MapBlock[] = [
  // Concrete
  { shape: 'box', position: [-38, 1, -30], size: [4, 2, 4], color: '#888888', proceduralMaterial: 'concrete', textureScale: [1, 1] },
  { shape: 'box', position: [-38, 0.05, -30], size: [5, 0.1, 5], color: '#444444', emissive: '#888888', emissiveIntensity: 0.3 },

  // Metal
  { shape: 'box', position: [-32, 1, -30], size: [4, 2, 4], color: '#aaaacc', proceduralMaterial: 'metal', textureScale: [2, 2] },
  { shape: 'box', position: [-32, 0.05, -30], size: [5, 0.1, 5], color: '#444466', emissive: '#aaaacc', emissiveIntensity: 0.3 },

  // Sci-fi Panel
  { shape: 'box', position: [-26, 1, -30], size: [4, 2, 4], color: '#4488aa', proceduralMaterial: 'scifi-panel', textureScale: [1, 1] },
  { shape: 'box', position: [-26, 0.05, -30], size: [5, 0.1, 5], color: '#224455', emissive: '#4488aa', emissiveIntensity: 0.3 },

  // Neon
  { shape: 'box', position: [-38, 1, -22], size: [4, 2, 4], color: '#00ff88', proceduralMaterial: 'neon', emissive: '#00ff88', emissiveIntensity: 2.0 },

  // Rust
  { shape: 'box', position: [-32, 1, -22], size: [4, 2, 4], color: '#887766', proceduralMaterial: 'rust', textureScale: [1, 1] },

  // Tile
  { shape: 'box', position: [-26, 1, -22], size: [4, 2, 4], color: '#cc9966', proceduralMaterial: 'tile', textureScale: [2, 2] },

  // Blend demo: concrete-to-rust height blend
  { shape: 'box', position: [-22, 3, -26], size: [2, 6, 2], color: '#888888', proceduralMaterial: 'concrete', blendProceduralMaterial: 'rust', blendMode: 'height', blendHeight: 3, blendSharpness: 2, textureScale: [1, 1] },

  // Blend demo: metal-to-tile noise blend
  { shape: 'box', position: [-22, 3, -30], size: [2, 6, 2], color: '#aaaacc', proceduralMaterial: 'metal', blendProceduralMaterial: 'tile', blendMode: 'noise', blendHeight: 0.5, blendSharpness: 3, textureScale: [1, 1] },
];

// ── 2. Shapes Zone (N: 0, 0, -35) ──

const SHAPE_BLOCKS: MapBlock[] = [
  // Box
  { shape: 'box', position: [-6, 1.5, -38], size: [3, 3, 3], color: '#e74c3c', emissive: '#e74c3c', emissiveIntensity: 0.3 },
  { shape: 'box', position: [-6, 0.05, -38], size: [4, 0.1, 4], color: '#e74c3c', emissive: '#e74c3c', emissiveIntensity: 1.0 },

  // Ramp
  { shape: 'ramp', position: [0, 1.5, -38], size: [3, 3, 5], color: '#3498db', emissive: '#3498db', emissiveIntensity: 0.3 },
  { shape: 'box', position: [0, 0.05, -38], size: [4, 0.1, 6], color: '#3498db', emissive: '#3498db', emissiveIntensity: 1.0 },

  // Cylinder
  { shape: 'cylinder', position: [6, 1.5, -38], size: [3, 3, 3], color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 0.3 },
  { shape: 'box', position: [6, 0.05, -38], size: [4, 0.1, 4], color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 1.0 },

  // Wedge
  { shape: 'wedge', position: [12, 1.5, -38], size: [3, 3, 3], color: '#f39c12', emissive: '#f39c12', emissiveIntensity: 0.3 },
  { shape: 'box', position: [12, 0.05, -38], size: [4, 0.1, 4], color: '#f39c12', emissive: '#f39c12', emissiveIntensity: 1.0 },
];

// ── 3. Emissive Animations Zone (NE: 30, 0, -30) ──

const EMISSIVE_BLOCKS: MapBlock[] = [
  // Pulse
  { shape: 'box', position: [26, 1, -34], size: [5, 2, 1], color: '#00ff88', proceduralMaterial: 'neon', emissive: '#00ff88', emissiveIntensity: 4.0, emissiveAnimation: 'pulse', emissiveAnimationSpeed: 1.5 },
  { shape: 'box', position: [26, 0.05, -34], size: [6, 0.1, 2], color: '#00ff88', emissive: '#00ff88', emissiveIntensity: 0.8 },

  // Flicker
  { shape: 'box', position: [32, 1, -34], size: [5, 2, 1], color: '#ff3300', proceduralMaterial: 'neon', emissive: '#ff3300', emissiveIntensity: 3.0, emissiveAnimation: 'flicker', emissiveAnimationSpeed: 2.0 },
  { shape: 'box', position: [32, 0.05, -34], size: [6, 0.1, 2], color: '#ff3300', emissive: '#ff3300', emissiveIntensity: 0.8 },

  // Breathe
  { shape: 'box', position: [38, 1, -34], size: [5, 2, 1], color: '#aa66ff', proceduralMaterial: 'neon', emissive: '#aa66ff', emissiveIntensity: 3.0, emissiveAnimation: 'breathe', emissiveAnimationSpeed: 0.8 },
  { shape: 'box', position: [38, 0.05, -34], size: [6, 0.1, 2], color: '#aa66ff', emissive: '#aa66ff', emissiveIntensity: 0.8 },

  // None (static glow for comparison)
  { shape: 'box', position: [32, 1, -28], size: [5, 2, 1], color: '#00ccff', proceduralMaterial: 'neon', emissive: '#00ccff', emissiveIntensity: 4.0, emissiveAnimation: 'none' },
  { shape: 'box', position: [32, 0.05, -28], size: [6, 0.1, 2], color: '#00ccff', emissive: '#00ccff', emissiveIntensity: 0.8 },
];

// ── 4. PBR Properties Zone (W: -35, 0, 0) ──

const PBR_BLOCKS: MapBlock[] = [
  // Roughness gradient: 0.0 → 1.0
  ...[0, 0.25, 0.5, 0.75, 1.0].map((r, i): MapBlock => ({
    shape: 'box',
    position: [-38, 1, -4 + i * 3] as Vec3,
    size: [2, 2, 2],
    color: '#cccccc',
    roughness: r,
    metalness: 0.8,
  })),
  // Ground label
  { shape: 'box', position: [-38, 0.05, 2], size: [3, 0.1, 16], color: '#cccccc', emissive: '#cccccc', emissiveIntensity: 0.5 },

  // Metalness gradient: 0.0 → 1.0
  ...[0, 0.25, 0.5, 0.75, 1.0].map((m, i): MapBlock => ({
    shape: 'box',
    position: [-33, 1, -4 + i * 3] as Vec3,
    size: [2, 2, 2],
    color: '#ddbb88',
    roughness: 0.3,
    metalness: m,
  })),
  { shape: 'box', position: [-33, 0.05, 2], size: [3, 0.1, 16], color: '#ddbb88', emissive: '#ddbb88', emissiveIntensity: 0.5 },

  // Transparency demo
  { shape: 'box', position: [-28, 1.5, -2], size: [3, 3, 3], color: '#3498db', transparent: true, opacity: 0.4 },
  { shape: 'box', position: [-28, 1.5, 2], size: [3, 3, 3], color: '#e74c3c', transparent: true, opacity: 0.7 },
  { shape: 'box', position: [-28, 0.05, 0], size: [4, 0.1, 8], color: '#3498db', emissive: '#3498db', emissiveIntensity: 0.5 },
];

// ── 5. Movement Items Zone (SW: -30, 0, 25) ──
// (BoostPad, LaunchPad, SpeedGate placed as MapData fields)

const MOVEMENT_BLOCKS: MapBlock[] = [
  // Platforms for the launch pad to aim at
  { shape: 'box', position: [-25, 8, 32], size: [5, 0.5, 5], color: '#ff6600', emissive: '#ff6600', emissiveIntensity: 0.3 },
];

// ── 6. Grapple / Ammo Zone (S: 0, 0, 30) ──

const GRAPPLE_BLOCKS: MapBlock[] = [
  // Elevated platform for grapple target
  { shape: 'box', position: [0, 10, 38], size: [6, 0.5, 6], color: '#a78bfa', emissive: '#a78bfa', emissiveIntensity: 0.3 },
  // Pillar support
  { shape: 'box', position: [0, 5, 38], size: [1, 10, 1], color: '#666680' },
];

// ── Combine all instanced blocks ──

const ALL_BLOCKS: MapBlock[] = [
  // Ground
  { shape: 'box', position: [0, -0.5, 0], size: [SIZE, 1, SIZE], color: '#2a2a2e' },

  // Boundary walls
  { shape: 'box', position: [0, WALL_H / 2, -HALF], size: [SIZE, WALL_H, 1], color: '#3a3a40' },
  { shape: 'box', position: [0, WALL_H / 2, HALF], size: [SIZE, WALL_H, 1], color: '#3a3a40' },
  { shape: 'box', position: [-HALF, WALL_H / 2, 0], size: [1, WALL_H, SIZE], color: '#3a3a40' },
  { shape: 'box', position: [HALF, WALL_H / 2, 0], size: [1, WALL_H, SIZE], color: '#3a3a40' },

  // Spawn pad
  { shape: 'box', position: [0, 0.05, 0], size: [4, 0.1, 4], color: '#556677', emissive: '#00ffcc', emissiveIntensity: 1.0 },

  // Zone labels
  ...labelPedestal(MATERIALS_POS, '#ff8800', 'MATERIALS'),
  ...labelPedestal([0, 0, -35], '#e74c3c', 'SHAPES'),
  ...labelPedestal([32, 0, -30], '#00ff88', 'EMISSIVE'),
  ...labelPedestal([-35, 0, 0], '#cccccc', 'PBR'),
  ...labelPedestal([-30, 0, 25], '#00ff88', 'MOVEMENT'),
  ...labelPedestal([0, 0, 30], '#a78bfa', 'GRAPPLE'),
  ...labelPedestal([30, 0, 0], '#ff6622', 'PARTICLES'),
  ...labelPedestal([30, 0, 25], '#aaccee', 'FOG'),
  ...labelPedestal([-30, 0, -5], '#3498db', 'WATER'),

  // Showcase blocks
  ...MATERIAL_BLOCKS,
  ...SHAPE_BLOCKS,
  ...EMISSIVE_BLOCKS,
  ...PBR_BLOCKS,
  ...MOVEMENT_BLOCKS,
  ...GRAPPLE_BLOCKS,
];

// ── Export MapData ──

export const SHOWCASE_MAP: MapData = {
  spawnPoint: [0, 1.5, 0],
  spawnDirection: [0, 0, -1],
  blocks: ALL_BLOCKS,

  checkpoints: [
    { position: [-30, 2, -30], size: [8, 4, 8], index: 0 },  // Materials
    { position: [32, 2, -30], size: [8, 4, 8], index: 1 },    // Emissive
    { position: [30, 2, 25], size: [8, 4, 8], index: 2 },     // Fog
  ],

  finish: {
    position: [0, 2, -8],
    size: [6, 4, 4],
  },

  boostPads: [
    { position: [-35, 0.1, 22], direction: [0, 0, 1], speed: 500, color: '#00ff88' },
    { position: [-30, 0.1, 22], direction: [1, 0, 0], speed: 300, color: '#00ccff' },
  ],

  launchPads: [
    { position: [-25, 0.15, 25], direction: [0, 0.7, 0.3], speed: 600, color: '#ff6600' },
  ],

  speedGates: [
    { position: [-30, 3, 30], multiplier: 1.5, minSpeed: 100, color: '#00ccff' },
  ],

  grapplePoints: [
    { position: [0, 14, 38] },
    { position: [6, 12, 35] },
    { position: [-6, 12, 35] },
  ],

  ammoPickups: [
    { position: [-35, 0.5, 28], weaponType: 'rocket', amount: 3 },
    { position: [-25, 0.5, 28], weaponType: 'grenade', amount: 2 },
  ],

  killZones: [
    { position: [0, -20, 0], size: [200, 5, 200] },
  ],

  // ── Water / Lava (W zone: -30, 0, -5) ──
  waterSurfaces: [
    {
      position: [-35, -0.3, 0],
      size: [14, 14],
      type: 'water',
      flowDirection: [0.7, 0.3],
      flowSpeed: 0.8,
      waveHeight: 0.25,
      waveScale: 2.0,
    },
    {
      position: [-35, -0.2, 12],
      size: [10, 8],
      type: 'lava',
      waveHeight: 0.15,
      waveScale: 3.0,
      flowSpeed: 0.4,
    },
  ],

  // ── Fog Volumes (SE zone: 30, 0, 25) ──
  fogVolumes: [
    {
      position: [30, 2, 22],
      shape: 'box',
      size: [8, 4, 8],
      color: '#aaccee',
      density: 0.4,
      heightFalloff: 0.8,
    },
    {
      position: [30, 4, 30],
      shape: 'sphere',
      size: [4, 4, 4],
      color: '#aa66ff',
      density: 0.5,
    },
  ],

  // ── Particle Emitters (E zone: 30, 0, 0) ──
  particleEmitters: [
    { position: [26, 0.5, -4], preset: 'smoke', count: 48, spread: 3, wind: [0.2, 0, 0.1] },
    { position: [32, 0.5, -4], preset: 'sparks', count: 24, spread: 0.5, color: '#ffaa00' },
    { position: [38, 0.5, -4], preset: 'ash', count: 64, spread: 5, color: '#ff6622' },
    { position: [26, 0.5, 4], preset: 'dust', count: 48, spread: 4 },
    { position: [32, 0.5, 4], preset: 'snow', count: 80, spread: 6, color: '#ffffff' },
    { position: [38, 0.5, 4], preset: 'pollen', count: 40, spread: 4, color: '#aaffaa' },
  ],

  skybox: 'night',

  lighting: {
    ambientIntensity: 0.6,
    ambientColor: '#8899bb',
    directionalIntensity: 1.2,
    directionalColor: '#ffffff',
    directionalPosition: [40, 80, 30],
    hemisphereGround: '#3a3a3a',
    hemisphereSky: '#87ceeb',
    hemisphereIntensity: 0.4,
    fogColor: '#1a1a2e',
    fogNear: 80,
    fogFar: 250,
  },

  backgroundColor: '#1a1a2e',
};
