/**
 * Kinematic moving platform — follows waypoints at configurable speed with
 * optional pause at each stop. Uses Rapier kinematic position body.
 *
 * Depends on: @react-three/rapier, @react-three/fiber
 * Used by: MapLoader
 */
import { useRef, useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { MovingPlatformData, Vec3 } from './types';

export function MovingPlatformRenderer({ platform }: { platform: MovingPlatformData }) {
  const rbRef = useRef<import('@react-three/rapier').RapierRigidBody>(null);
  const timeRef = useRef(0);
  // Per-instance scratch vectors — avoids shared-singleton bugs with multiple platforms
  const vecRef = useRef({ from: new Vector3(), to: new Vector3(), pos: new Vector3() });
  const color = platform.color ?? '#8888aa';

  // Pre-compute segment lengths once (stable reference — waypoints don't change)
  const { segments, totalLength } = useMemo(() => {
    const segs: number[] = [];
    let total = 0;
    const wps = platform.waypoints;
    for (let i = 0; i < wps.length; i++) {
      const next = wps[(i + 1) % wps.length];
      const curr = wps[i];
      const len = Math.sqrt(
        (next[0] - curr[0]) ** 2 +
        (next[1] - curr[1]) ** 2 +
        (next[2] - curr[2]) ** 2,
      );
      segs.push(len);
      total += len;
    }
    return { segments: segs, totalLength: total };
  }, [platform.waypoints]);

  useFrame((_, delta) => {
    const rb = rbRef.current;
    if (!rb || platform.waypoints.length < 2) return;

    timeRef.current += delta;

    const waypoints = platform.waypoints;
    const pauseTotal = (platform.pauseTime ?? 0) * waypoints.length;
    const moveTime = totalLength / platform.speed;
    const cycleTime = moveTime + pauseTotal;
    const t = timeRef.current % cycleTime;

    // Find which segment we're on
    let elapsed = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const segmentMoveTime = segments[i] / platform.speed;
      const segmentPause = platform.pauseTime ?? 0;
      const segmentTotal = segmentMoveTime + segmentPause;

      if (t < elapsed + segmentTotal) {
        const localT = t - elapsed;
        if (localT < segmentPause) {
          rb.setNextKinematicTranslation({
            x: waypoints[i][0], y: waypoints[i][1], z: waypoints[i][2],
          });
        } else {
          const moveFrac = Math.min((localT - segmentPause) / segmentMoveTime, 1);
          const next = waypoints[(i + 1) % waypoints.length];
          const { from, to, pos } = vecRef.current;
          from.set(waypoints[i][0], waypoints[i][1], waypoints[i][2]);
          to.set(next[0], next[1], next[2]);
          pos.lerpVectors(from, to, moveFrac);
          rb.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
        }
        break;
      }
      elapsed += segmentTotal;
    }
  });

  const halfSize: Vec3 = [platform.size[0] / 2, platform.size[1] / 2, platform.size[2] / 2];

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders={false} position={platform.waypoints[0]}>
      <CuboidCollider args={halfSize} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={platform.size} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}
