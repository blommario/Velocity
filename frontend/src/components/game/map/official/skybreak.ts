import type { MapData } from '../types';

/**
 * Skybreak — Expert. Tactical operations compound on a desert plateau.
 * Flat arena with concrete floors, metal walls, corridors, and open courtyards.
 * Professional military-base aesthetic. Par: 90s
 */
export const SKYBREAK: MapData = {
  spawnPoint: [0, 1.5, 0],
  spawnDirection: [0, 0, -1],
  blocks: [
    // ═══════════════════════════════════════════════════════
    // SECTION 1: SPAWN COURTYARD — Open tactical compound entry
    // ═══════════════════════════════════════════════════════

    // Main ground slab — massive concrete foundation, top at Y=0
    { shape: 'box', position: [0, -2, -60], size: [120, 4, 160], color: '#4a4a4a', textureSet: 'concrete-034', textureScale: [15, 20] },

    // Spawn pad — slightly raised metal platform (top Y=0.15)
    { shape: 'box', position: [0, 0.075, 0], size: [8, 0.15, 8], color: '#556677', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [2, 2] },
    // Spawn pad edge trim
    { shape: 'box', position: [0, 0.2, 0], size: [8.4, 0.05, 8.4], color: '#ff8800', emissive: '#ff8800', emissiveIntensity: 1.5 },

    // Perimeter walls — compound boundary (left/right) — tall concrete
    { shape: 'box', position: [-55, 4, -60], size: [3, 8, 160], color: '#555555', textureSet: 'concrete-034', textureScale: [20, 2] },
    { shape: 'box', position: [55, 4, -60], size: [3, 8, 160], color: '#555555', textureSet: 'concrete-034', textureScale: [20, 2] },
    // Perimeter back wall (behind spawn)
    { shape: 'box', position: [0, 4, 15], size: [113, 8, 3], color: '#555555', textureSet: 'concrete-034', textureScale: [14, 2] },
    // Perimeter front wall (far end with gate opening)
    { shape: 'box', position: [-35, 4, -140], size: [43, 8, 3], color: '#555555', textureSet: 'concrete-034', textureScale: [6, 2] },
    { shape: 'box', position: [35, 4, -140], size: [43, 8, 3], color: '#555555', textureSet: 'concrete-034', textureScale: [6, 2] },

    // ── Spawn area cover blocks — low walls for tactical feel ──
    // Left L-shaped cover
    { shape: 'box', position: [-12, 0.75, -6], size: [6, 1.5, 1], color: '#606060', textureSet: 'concrete-034', textureScale: [2, 1] },
    { shape: 'box', position: [-14, 0.75, -9], size: [1, 1.5, 5], color: '#606060', textureSet: 'concrete-034', textureScale: [1, 2] },
    // Right L-shaped cover
    { shape: 'box', position: [12, 0.75, -6], size: [6, 1.5, 1], color: '#606060', textureSet: 'concrete-034', textureScale: [2, 1] },
    { shape: 'box', position: [14, 0.75, -9], size: [1, 1.5, 5], color: '#606060', textureSet: 'concrete-034', textureScale: [1, 2] },

    // ═══════════════════════════════════════════════════════
    // SECTION 2: MAIN CORRIDOR — Industrial hallway with metal walls
    // ═══════════════════════════════════════════════════════

    // Corridor left wall — scifi metal panels
    { shape: 'box', position: [-8, 3, -28], size: [1.5, 6, 24], color: '#3d4f5f', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 2] },
    // Corridor right wall
    { shape: 'box', position: [8, 3, -28], size: [1.5, 6, 24], color: '#3d4f5f', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [4, 2] },

    // Corridor floor — raised metal grating
    { shape: 'box', position: [0, -0.1, -28], size: [15, 0.2, 24], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [4, 6] },

    // Accent light strips on corridor walls (orange tactical lighting)
    { shape: 'box', position: [-7.2, 1.5, -28], size: [0.08, 0.3, 24], color: '#ff6600', emissive: '#ff6600', emissiveIntensity: 2.5 },
    { shape: 'box', position: [7.2, 1.5, -28], size: [0.08, 0.3, 24], color: '#ff6600', emissive: '#ff6600', emissiveIntensity: 2.5 },
    { shape: 'box', position: [-7.2, 4.5, -28], size: [0.08, 0.2, 24], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 1.5 },
    { shape: 'box', position: [7.2, 4.5, -28], size: [0.08, 0.2, 24], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 1.5 },

    // Corridor ceiling beams (crossbeams for industrial feel)
    { shape: 'box', position: [0, 5.8, -22], size: [15, 0.6, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [4, 1] },
    { shape: 'box', position: [0, 5.8, -28], size: [15, 0.6, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [4, 1] },
    { shape: 'box', position: [0, 5.8, -34], size: [15, 0.6, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [4, 1] },

    // Mid-corridor cover — half-height barricade
    { shape: 'box', position: [0, 0.6, -30], size: [4, 1.2, 0.8], color: '#4a5a6a', textureSet: 'metal-009', textureScale: [2, 1] },

    // ═══════════════════════════════════════════════════════
    // SECTION 3: OPEN ARENA — Wide courtyard with scattered cover
    // ═══════════════════════════════════════════════════════

    // Arena floor accent — subtle grid overlay
    { shape: 'box', position: [0, 0.01, -62], size: [50, 0.02, 30], color: '#3a4a5a', emissive: '#334455', emissiveIntensity: 0.3, transparent: true, opacity: 0.4 },

    // Central pillar — tall concrete column
    { shape: 'box', position: [0, 3, -62], size: [3, 6, 3], color: '#505050', textureSet: 'concrete-034', textureScale: [1, 2] },
    // Pillar cap — metal
    { shape: 'box', position: [0, 6.1, -62], size: [3.5, 0.2, 3.5], color: '#667788', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },

    // Scattered cover walls — varying heights for tactical gameplay
    // Left cluster
    { shape: 'box', position: [-16, 1.5, -55], size: [6, 3, 1], color: '#585858', textureSet: 'concrete-034', textureScale: [2, 1] },
    { shape: 'box', position: [-20, 0.6, -60], size: [1, 1.2, 8], color: '#4a5a6a', textureSet: 'metal-009', textureScale: [1, 3] },
    { shape: 'box', position: [-12, 1, -68], size: [5, 2, 0.8], color: '#585858', textureSet: 'concrete-034', textureScale: [2, 1] },

    // Right cluster
    { shape: 'box', position: [16, 1.5, -55], size: [6, 3, 1], color: '#585858', textureSet: 'concrete-034', textureScale: [2, 1] },
    { shape: 'box', position: [20, 0.6, -60], size: [1, 1.2, 8], color: '#4a5a6a', textureSet: 'metal-009', textureScale: [1, 3] },
    { shape: 'box', position: [12, 1, -68], size: [5, 2, 0.8], color: '#585858', textureSet: 'concrete-034', textureScale: [2, 1] },

    // Center-left angled cover
    { shape: 'box', position: [-8, 1, -58], size: [4, 2, 1], color: '#505050', textureSet: 'concrete-034', textureScale: [1, 1], rotation: [0, 0.4, 0] },
    // Center-right angled cover
    { shape: 'box', position: [8, 1, -58], size: [4, 2, 1], color: '#505050', textureSet: 'concrete-034', textureScale: [1, 1], rotation: [0, -0.4, 0] },

    // ═══════════════════════════════════════════════════════
    // SECTION 4: ELEVATED WALKWAY — Metal catwalk with railings
    // ═══════════════════════════════════════════════════════

    // Ramp up from arena to walkway (left side) — top at Y=3
    { shape: 'box', position: [-30, 1.5, -70], size: [8, 0.3, 12], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 3], rotation: [0.25, 0, 0] },

    // Elevated walkway — metal grating at Y=3
    { shape: 'box', position: [-30, 3, -82], size: [10, 0.3, 12], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 3] },

    // Walkway support pillars
    { shape: 'box', position: [-34, 1.5, -78], size: [0.6, 3, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [1, 2] },
    { shape: 'box', position: [-26, 1.5, -78], size: [0.6, 3, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [1, 2] },
    { shape: 'box', position: [-34, 1.5, -86], size: [0.6, 3, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [1, 2] },
    { shape: 'box', position: [-26, 1.5, -86], size: [0.6, 3, 0.6], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [1, 2] },

    // Walkway railings (left/right)
    { shape: 'box', position: [-35, 4, -82], size: [0.15, 1.5, 12], color: '#556677', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 3] },
    { shape: 'box', position: [-25, 4, -82], size: [0.15, 1.5, 12], color: '#556677', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [1, 3] },

    // Walkway continues right — connecting bridge at Y=3
    { shape: 'box', position: [-12, 3, -88], size: [26, 0.3, 5], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [6, 1] },
    // Bridge railing
    { shape: 'box', position: [-12, 4, -85.5], size: [26, 1.5, 0.15], color: '#556677', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [6, 1] },
    { shape: 'box', position: [-12, 4, -90.5], size: [26, 1.5, 0.15], color: '#556677', textureSet: 'scifi-metal-mesh-002/Sci-fi_Metal_Mesh_002', textureScale: [6, 1] },

    // Right walkway platform at Y=3
    { shape: 'box', position: [8, 3, -88], size: [12, 0.3, 10], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [3, 2] },

    // Drop-down ramp from right walkway back to ground
    { shape: 'box', position: [18, 1.5, -88], size: [8, 0.3, 8], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [2, 2], rotation: [0, 0, -0.35] },

    // ═══════════════════════════════════════════════════════
    // SECTION 5: BACK COMPOUND — Tight corridors & wall-run channels
    // ═══════════════════════════════════════════════════════

    // Left building structure — creates corridor
    { shape: 'box', position: [-25, 3.5, -105], size: [12, 7, 20], color: '#484848', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 2] },
    // Hollow interior (cutout) — walkable corridor through building
    // Left wall of corridor
    { shape: 'box', position: [-22, 2, -105], size: [1, 4, 20], color: '#3d4f5f', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 1] },
    // Right wall of corridor
    { shape: 'box', position: [-16, 2, -105], size: [1, 4, 20], color: '#3d4f5f', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 1] },
    // Corridor ceiling
    { shape: 'box', position: [-19, 4.1, -105], size: [5, 0.3, 20], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [2, 5] },
    // Corridor floor
    { shape: 'box', position: [-19, -0.05, -105], size: [5, 0.1, 20], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 5] },

    // Corridor interior light strips
    { shape: 'box', position: [-21.5, 3.8, -105], size: [0.08, 0.15, 20], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 2.0 },
    { shape: 'box', position: [-16.5, 3.8, -105], size: [0.08, 0.15, 20], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 2.0 },

    // Right building — mirrored
    { shape: 'box', position: [25, 3.5, -105], size: [12, 7, 20], color: '#484848', textureSet: 'scifi-wall-015/Sci-Fi_Wall_015', textureScale: [3, 2] },
    // Right corridor walls
    { shape: 'box', position: [16, 2, -105], size: [1, 4, 20], color: '#3d4f5f', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 1] },
    { shape: 'box', position: [22, 2, -105], size: [1, 4, 20], color: '#3d4f5f', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 1] },
    // Right corridor ceiling & floor
    { shape: 'box', position: [19, 4.1, -105], size: [5, 0.3, 20], color: '#3a3a3a', textureSet: 'metal-009', textureScale: [2, 5] },
    { shape: 'box', position: [19, -0.05, -105], size: [5, 0.1, 20], color: '#5a6a7a', textureSet: 'metal-grill-024/Metal_Grill_024', textureScale: [1, 5] },
    // Right corridor light strips
    { shape: 'box', position: [16.5, 3.8, -105], size: [0.08, 0.15, 20], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 2.0 },
    { shape: 'box', position: [21.5, 3.8, -105], size: [0.08, 0.15, 20], color: '#ff4400', emissive: '#ff4400', emissiveIntensity: 2.0 },

    // Wall-run channel between buildings (open center gap)
    // Wall-run surfaces (smooth scifi walls)
    { shape: 'box', position: [-10, 3, -105], size: [1, 6, 20], color: '#3d5060', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 2] },
    { shape: 'box', position: [10, 3, -105], size: [1, 6, 20], color: '#3d5060', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [3, 2] },

    // ═══════════════════════════════════════════════════════
    // SECTION 6: FINAL PLAZA — Victory area with dramatic finish
    // ═══════════════════════════════════════════════════════

    // Final plaza raised platform — top at Y=0.3
    { shape: 'box', position: [0, 0.15, -128], size: [40, 0.3, 16], color: '#556677', textureSet: 'scifi-metal-panel-007/Sci_fi_Metal_Panel_007', textureScale: [5, 2] },

    // Victory pedestal — raised center
    { shape: 'box', position: [0, 0.5, -132], size: [12, 1, 8], color: '#667788', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [2, 1] },

    // Victory glow accent
    { shape: 'box', position: [0, 1.02, -132], size: [11, 0.04, 7], color: '#44aaff', emissive: '#44aaff', emissiveIntensity: 1.5, transparent: true, opacity: 0.35 },

    // Decorative pillars flanking finish
    { shape: 'box', position: [-8, 3, -132], size: [1.5, 6, 1.5], color: '#4a5a6a', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [1, 2] },
    { shape: 'box', position: [8, 3, -132], size: [1.5, 6, 1.5], color: '#4a5a6a', textureSet: 'scifi-wall-013/Sci-Fi_Wall_013', textureScale: [1, 2] },
    // Pillar caps
    { shape: 'box', position: [-8, 6.1, -132], size: [2, 0.2, 2], color: '#ff6600', emissive: '#ff6600', emissiveIntensity: 2.0 },
    { shape: 'box', position: [8, 6.1, -132], size: [2, 0.2, 2], color: '#ff6600', emissive: '#ff6600', emissiveIntensity: 2.0 },

    // ═══════════════════════════════════════════════════════
    // DECORATION — Scattered details for visual richness
    // ═══════════════════════════════════════════════════════

    // Crate clusters (spawn area)
    { shape: 'box', position: [-6, 0.75, 5], size: [1.5, 1.5, 1.5], color: '#6a5a3a', textureSet: 'metal-009', textureScale: [1, 1] },
    { shape: 'box', position: [-4.5, 0.5, 5.5], size: [1, 1, 1], color: '#6a5a3a', textureSet: 'metal-009', textureScale: [1, 1] },
    { shape: 'box', position: [6, 0.75, 5], size: [1.5, 1.5, 1.5], color: '#6a5a3a', textureSet: 'metal-009', textureScale: [1, 1] },

    // Bollards along main path (cylinders)
    { shape: 'cylinder', position: [-6, 0.5, -15], size: [0.5, 1, 0.5], color: '#ff8800', emissive: '#ff6600', emissiveIntensity: 1.0 },
    { shape: 'cylinder', position: [6, 0.5, -15], size: [0.5, 1, 0.5], color: '#ff8800', emissive: '#ff6600', emissiveIntensity: 1.0 },

    // Arena central floor marking — X pattern (thin strips)
    { shape: 'box', position: [0, 0.02, -62], size: [0.15, 0.04, 28], color: '#ff8800', emissive: '#ff6600', emissiveIntensity: 1.0 },
    { shape: 'box', position: [0, 0.02, -62], size: [28, 0.04, 0.15], color: '#ff8800', emissive: '#ff6600', emissiveIntensity: 1.0 },

    // Wall-mounted detail panels (arena perimeter)
    { shape: 'box', position: [-53, 3, -40], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [-53, 3, -55], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [-53, 3, -70], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [53, 3, -40], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [53, 3, -55], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },
    { shape: 'box', position: [53, 3, -70], size: [0.3, 2, 4], color: '#556677', textureSet: 'scifi-metal-panel-005/Sci_fi_Metal_Panel_005', textureScale: [1, 1] },

    // Ground floor accent lines (concrete seams)
    { shape: 'box', position: [0, 0.005, -30], size: [40, 0.01, 0.1], color: '#333333' },
    { shape: 'box', position: [0, 0.005, -50], size: [60, 0.01, 0.1], color: '#333333' },
    { shape: 'box', position: [0, 0.005, -75], size: [60, 0.01, 0.1], color: '#333333' },
    { shape: 'box', position: [0, 0.005, -95], size: [60, 0.01, 0.1], color: '#333333' },
  ],

  checkpoints: [
    // CP0: End of corridor, entering arena
    { position: [0, 2, -40], size: [14, 5, 3], index: 0 },
    // CP1: Center of arena
    { position: [0, 2, -65], size: [14, 5, 3], index: 1 },
    // CP2: On the elevated walkway
    { position: [-12, 5, -88], size: [10, 4, 5], index: 2 },
    // CP3: Through the back corridors
    { position: [0, 2, -115], size: [18, 5, 3], index: 3 },
  ],

  finish: {
    position: [0, 2.5, -132],
    size: [10, 4, 6],
  },

  killZones: [
    { position: [0, -20, -60], size: [300, 5, 300] },
  ],

  boostPads: [
    // Boost out of spawn into corridor
    { position: [0, 0.1, -5], direction: [0, 0, -1], speed: 400, color: '#ff8800' },
    // Boost through center of arena
    { position: [0, 0.1, -50], direction: [0, 0, -1], speed: 350, color: '#ff6600' },
  ],

  launchPads: [
    // Launch up to elevated walkway from arena floor
    { position: [-30, 0.1, -68], direction: [0, 0.85, -0.52], speed: 300, color: '#ff4400' },
  ],

  speedGates: [
    // Speed gate exiting the back corridors
    { position: [0, 2, -96], size: [8, 5, 1], color: '#ff8800' },
  ],

  ammoPickups: [
    { position: [-16, 1, -62], weaponType: 'rocket', amount: 3 },
    { position: [16, 1, -62], weaponType: 'rocket', amount: 3 },
    { position: [-30, 4, -85], weaponType: 'grenade', amount: 2 },
    { position: [0, 1, -105], weaponType: 'rocket', amount: 2 },
  ],

  settings: {
    maxRocketAmmo: 10,
    maxGrenadeAmmo: 3,
    parTime: 90,
  },

  lighting: {
    ambientIntensity: 0.35,
    ambientColor: '#ccaa88',
    directionalIntensity: 1.8,
    directionalColor: '#ffeedd',
    directionalPosition: [80, 100, 40],
    hemisphereGround: '#443322',
    hemisphereSky: '#ddbb99',
    hemisphereIntensity: 0.4,
    fogColor: '#aa8866',
    fogNear: 60,
    fogFar: 200,
  },

  skybox: 'hdri:satara_night_2k.hdr',
  backgroundColor: '#aa8866',
};
