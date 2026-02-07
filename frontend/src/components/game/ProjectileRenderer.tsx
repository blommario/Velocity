import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../../stores/combatStore';

const ROCKET_COLOR = '#ff4400';
const ROCKET_GLOW = '#ff8800';
const GRENADE_COLOR = '#44ff00';

const TRAIL_LENGTH = 5;
const TRAIL_INTERVAL = 0.02; // seconds between trail samples

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

export function ProjectileRenderer() {
  const projectiles = useCombatStore((s) => s.projectiles);
  const trailsRef = useRef<Map<string, TrailData>>(new Map());

  useFrame((_, delta) => {
    const trails = trailsRef.current;
    const activeIds = new Set(projectiles.map((p) => p.id));

    // Clean up trails for removed projectiles
    for (const id of trails.keys()) {
      if (!activeIds.has(id)) trails.delete(id);
    }

    // Update trails for active projectiles
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
      // Age all points
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
              {/* Rocket core — bright glowing sphere */}
              <mesh position={p.position}>
                <sphereGeometry args={[0.35, 12, 12]} />
                <meshStandardMaterial
                  color={ROCKET_COLOR}
                  emissive={ROCKET_COLOR}
                  emissiveIntensity={8}
                />
              </mesh>
              {/* Outer glow halo */}
              <mesh position={p.position}>
                <sphereGeometry args={[0.6, 8, 8]} />
                <meshStandardMaterial
                  color={ROCKET_GLOW}
                  emissive={ROCKET_GLOW}
                  emissiveIntensity={3}
                  transparent
                  opacity={0.3}
                />
              </mesh>
              {/* Point light on rocket */}
              <pointLight
                position={p.position}
                color={ROCKET_COLOR}
                intensity={15}
                distance={12}
                decay={2}
              />
              {/* Trail particles */}
              {trail?.points.map((pt, i) => {
                const t = i / Math.max(trail.points.length - 1, 1);
                const size = 0.25 * (1 - t * 0.6);
                const opacity = 0.6 * (1 - t * 0.8);
                return (
                  <mesh key={i} position={[pt.x, pt.y, pt.z]}>
                    <sphereGeometry args={[size, 6, 6]} />
                    <meshStandardMaterial
                      color={ROCKET_GLOW}
                      emissive={ROCKET_GLOW}
                      emissiveIntensity={4 * (1 - t)}
                      transparent
                      opacity={opacity}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        }

        // Grenades — slightly upgraded
        return (
          <group key={p.id}>
            <mesh position={p.position}>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshStandardMaterial
                color={GRENADE_COLOR}
                emissive={GRENADE_COLOR}
                emissiveIntensity={4}
              />
            </mesh>
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
