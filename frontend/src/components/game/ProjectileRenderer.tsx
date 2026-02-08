import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { SphereGeometry, MeshBasicMaterial, AdditiveBlending } from 'three';
import { useCombatStore } from '../../stores/combatStore';

const ROCKET_COLOR = '#ff4400';
const ROCKET_GLOW = '#ff8800';
const GRENADE_COLOR = '#44ff00';

const TRAIL_LENGTH = 5;
const TRAIL_INTERVAL = 0.02;

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

/** Shared geometries and materials — created once, reused for all projectiles */
function useSharedAssets() {
  const assets = useMemo(() => {
    const rocketCoreGeo = new SphereGeometry(0.35, 10, 10);
    const rocketGlowGeo = new SphereGeometry(0.6, 6, 6);
    const trailGeo = new SphereGeometry(0.25, 5, 5);
    const grenadeGeo = new SphereGeometry(0.18, 6, 6);

    const rocketCoreMat = new MeshBasicMaterial({
      color: ROCKET_COLOR,
      toneMapped: false,
    });
    // Boost brightness by setting color to a brighter value (emissive simulation)
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

  useEffect(() => {
    return () => {
      assets.rocketCoreGeo.dispose();
      assets.rocketGlowGeo.dispose();
      assets.trailGeo.dispose();
      assets.grenadeGeo.dispose();
      assets.rocketCoreMat.dispose();
      assets.rocketGlowMat.dispose();
      assets.trailMat.dispose();
      assets.grenadeCoreMat.dispose();
    };
  }, [assets]);

  return assets;
}

export function ProjectileRenderer() {
  const projectiles = useCombatStore((s) => s.projectiles);
  const trailsRef = useRef<Map<number, TrailData>>(new Map());
  const assets = useSharedAssets();

  useFrame((_, delta) => {
    const trails = trailsRef.current;
    const activeIds = new Set(projectiles.map((p) => p.id));

    // Clean up trails for removed projectiles
    for (const id of trails.keys()) {
      if (!activeIds.has(id)) trails.delete(id);
    }

    // Update trails for active rockets
    for (const p of projectiles) {
      if (p.type !== 'rocket') continue;
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
      for (const pt of trail.points) pt.age += delta;
    }
  });

  return (
    <group>
      {projectiles.map((p) => {
        if (p.type === 'rocket') {
          const trail = trailsRef.current.get(p.id);
          return (
            <group key={p.id}>
              {/* Rocket core */}
              <mesh position={p.position} geometry={assets.rocketCoreGeo} material={assets.rocketCoreMat} />
              {/* Outer glow halo */}
              <mesh position={p.position} geometry={assets.rocketGlowGeo} material={assets.rocketGlowMat} />
              {/* Single point light per rocket */}
              <pointLight
                position={p.position}
                color={ROCKET_COLOR}
                intensity={15}
                distance={12}
                decay={2}
              />
              {/* Trail particles — shared geometry & material */}
              {trail?.points.map((pt, i) => {
                const t = i / Math.max(trail.points.length - 1, 1);
                const scale = 1 - t * 0.6;
                return (
                  <mesh
                    key={i}
                    position={[pt.x, pt.y, pt.z]}
                    scale={scale}
                    geometry={assets.trailGeo}
                    material={assets.trailMat}
                  />
                );
              })}
            </group>
          );
        }

        // Grenades
        return (
          <group key={p.id}>
            <mesh position={p.position} geometry={assets.grenadeGeo} material={assets.grenadeCoreMat} />
            <pointLight
              position={p.position}
              color={GRENADE_COLOR}
              intensity={5}
              distance={6}
              decay={2}
            />
          </group>
        );
      })}
    </group>
  );
}
