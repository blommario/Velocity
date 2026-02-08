import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  SphereGeometry, MeshBasicMaterial, AdditiveBlending,
  Mesh, PointLight, Group,
} from 'three';
import { useCombatStore } from '../../stores/combatStore';
import { devLog, frameTiming } from '../../engine/stores/devLogStore';

const ROCKET_COLOR = '#ff4400';
const ROCKET_GLOW = '#ff8800';
const GRENADE_COLOR = '#44ff00';

const TRAIL_LENGTH = 5;
const TRAIL_INTERVAL = 0.02;

/** Pool sizes — generous ceiling for simultaneous projectiles */
const POOL = {
  ROCKETS: 8,
  GRENADES: 4,
  TRAIL_PER_ROCKET: TRAIL_LENGTH,
} as const;

interface TrailPoint {
  x: number;
  y: number;
  z: number;
  age: number;
}

interface TrailData {
  points: TrailPoint[];
  lastSampleTime: number;
}

interface RocketSlot {
  group: Group;
  core: Mesh;
  glow: Mesh;
  light: PointLight;
  trails: Mesh[];
  activeId: number; // 0 = inactive
}

interface GrenadeSlot {
  group: Group;
  core: Mesh;
  light: PointLight;
  activeId: number;
}

/** Hidden position for inactive pooled objects */
const HIDDEN_Y = -9999;
const _hiddenPos: [number, number, number] = [0, HIDDEN_Y, 0];

export function ProjectileRenderer() {
  const { scene } = useThree();
  const trailsRef = useRef<Map<number, TrailData>>(new Map());
  const rocketsRef = useRef<RocketSlot[]>([]);
  const grenadesRef = useRef<GrenadeSlot[]>([]);
  const containerRef = useRef<Group | null>(null);

  // Create shared geometries & materials once
  const assets = useMemo(() => {
    const rocketCoreGeo = new SphereGeometry(0.35, 10, 10);
    const rocketGlowGeo = new SphereGeometry(0.6, 6, 6);
    const trailGeo = new SphereGeometry(0.25, 5, 5);
    const grenadeGeo = new SphereGeometry(0.18, 6, 6);

    const rocketCoreMat = new MeshBasicMaterial({
      color: ROCKET_COLOR,
      toneMapped: false,
    });
    rocketCoreMat.color.multiplyScalar(8);

    const rocketGlowMat = new MeshBasicMaterial({
      color: ROCKET_GLOW,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    rocketGlowMat.color.multiplyScalar(3);

    const trailMat = new MeshBasicMaterial({
      color: ROCKET_GLOW,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    trailMat.color.multiplyScalar(3);

    const grenadeCoreMat = new MeshBasicMaterial({
      color: GRENADE_COLOR,
      toneMapped: false,
    });
    grenadeCoreMat.color.multiplyScalar(4);

    return {
      rocketCoreGeo, rocketGlowGeo, trailGeo, grenadeGeo,
      rocketCoreMat, rocketGlowMat, trailMat, grenadeCoreMat,
    };
  }, []);

  // Pre-allocate entire pool imperatively on mount
  useEffect(() => {
    const container = new Group();
    container.name = 'ProjectilePool';
    scene.add(container);
    containerRef.current = container;

    // Rocket pool
    const rockets: RocketSlot[] = [];
    for (let i = 0; i < POOL.ROCKETS; i++) {
      const group = new Group();
      group.visible = false;
      group.position.set(0, HIDDEN_Y, 0);

      const core = new Mesh(assets.rocketCoreGeo, assets.rocketCoreMat);
      const glow = new Mesh(assets.rocketGlowGeo, assets.rocketGlowMat);
      const light = new PointLight(ROCKET_COLOR, 15, 12, 2);

      group.add(core, glow, light);

      // Trail meshes
      const trails: Mesh[] = [];
      for (let t = 0; t < POOL.TRAIL_PER_ROCKET; t++) {
        const trailMesh = new Mesh(assets.trailGeo, assets.trailMat);
        trailMesh.visible = false;
        group.add(trailMesh);
        trails.push(trailMesh);
      }

      container.add(group);
      rockets.push({ group, core, glow, light, trails, activeId: 0 });
    }
    rocketsRef.current = rockets;

    // Grenade pool
    const grenades: GrenadeSlot[] = [];
    for (let i = 0; i < POOL.GRENADES; i++) {
      const group = new Group();
      group.visible = false;
      group.position.set(0, HIDDEN_Y, 0);

      const core = new Mesh(assets.grenadeGeo, assets.grenadeCoreMat);
      const light = new PointLight(GRENADE_COLOR, 5, 6, 2);

      group.add(core, light);
      container.add(group);
      grenades.push({ group, core, light, activeId: 0 });
    }
    grenadesRef.current = grenades;

    devLog.success('Projectile', `Pool ready: ${POOL.ROCKETS} rockets + ${POOL.GRENADES} grenades (pre-allocated)`);

    return () => {
      scene.remove(container);
      // Dispose shared assets
      assets.rocketCoreGeo.dispose();
      assets.rocketGlowGeo.dispose();
      assets.trailGeo.dispose();
      assets.grenadeGeo.dispose();
      assets.rocketCoreMat.dispose();
      assets.rocketGlowMat.dispose();
      assets.trailMat.dispose();
      assets.grenadeCoreMat.dispose();
      containerRef.current = null;
      rocketsRef.current = [];
      grenadesRef.current = [];
      devLog.info('Projectile', 'Pool disposed');
    };
  }, [scene, assets]);

  // Update pool every frame — NO React re-renders, just imperative position updates
  useFrame((_, delta) => {
    frameTiming.begin('Projectiles');

    // Read state transiently — no Zustand subscription, no React re-render
    const projectiles = useCombatStore.getState().projectiles;
    const rockets = rocketsRef.current;
    const grenades = grenadesRef.current;
    const trails = trailsRef.current;

    // Build active ID set for trail cleanup
    const activeIds = new Set<number>();
    for (let i = 0; i < projectiles.length; i++) {
      activeIds.add(projectiles[i].id);
    }

    // Clean up trails for removed projectiles
    for (const id of trails.keys()) {
      if (!activeIds.has(id)) trails.delete(id);
    }

    // Mark all slots inactive — we'll reactivate matched ones below
    for (let i = 0; i < rockets.length; i++) rockets[i].activeId = 0;
    for (let i = 0; i < grenades.length; i++) grenades[i].activeId = 0;

    // Assign projectiles to pool slots
    let rocketIdx = 0;
    let grenadeIdx = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];

      if (p.type === 'rocket') {
        if (rocketIdx >= rockets.length) continue;
        const slot = rockets[rocketIdx++];
        slot.activeId = p.id;
        slot.group.visible = true;
        slot.group.position.set(p.position[0], p.position[1], p.position[2]);

        // Update trail data
        let trail = trails.get(p.id);
        if (!trail) {
          trail = { points: [], lastSampleTime: 0 };
          trails.set(p.id, trail);
        }
        trail.lastSampleTime += delta;
        if (trail.lastSampleTime >= TRAIL_INTERVAL) {
          trail.lastSampleTime = 0;
          trail.points.push({ x: p.position[0], y: p.position[1], z: p.position[2], age: 0 });
          if (trail.points.length > TRAIL_LENGTH) trail.points.shift();
        }
        for (let j = 0; j < trail.points.length; j++) {
          trail.points[j].age += delta;
        }

        // Position trail meshes
        for (let t = 0; t < slot.trails.length; t++) {
          if (t < trail.points.length) {
            const pt = trail.points[t];
            const fadeT = t / Math.max(trail.points.length - 1, 1);
            const scale = 1 - fadeT * 0.6;
            slot.trails[t].visible = true;
            slot.trails[t].position.set(
              pt.x - p.position[0],
              pt.y - p.position[1],
              pt.z - p.position[2],
            );
            slot.trails[t].scale.setScalar(scale);
          } else {
            slot.trails[t].visible = false;
          }
        }
      } else {
        // Grenade
        if (grenadeIdx >= grenades.length) continue;
        const slot = grenades[grenadeIdx++];
        slot.activeId = p.id;
        slot.group.visible = true;
        slot.group.position.set(p.position[0], p.position[1], p.position[2]);
      }
    }

    // Hide unused slots
    for (let i = rocketIdx; i < rockets.length; i++) {
      if (rockets[i].group.visible) {
        rockets[i].group.visible = false;
        rockets[i].group.position.set(0, HIDDEN_Y, 0);
        // Hide all trail meshes
        for (let t = 0; t < rockets[i].trails.length; t++) {
          rockets[i].trails[t].visible = false;
        }
      }
    }
    for (let i = grenadeIdx; i < grenades.length; i++) {
      if (grenades[i].group.visible) {
        grenades[i].group.visible = false;
        grenades[i].group.position.set(0, HIDDEN_Y, 0);
      }
    }

    frameTiming.end('Projectiles');
  });

  // No JSX rendering — everything is managed imperatively via the scene
  return null;
}
