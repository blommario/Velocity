import { useEffect, useRef, useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Object3D, InstancedMesh, Euler, BoxGeometry } from 'three';
import type { SurfRampData, Vec3 } from '../types/map';

const DEFAULT_RAMP_COLOR = '#6688aa';

interface RampGroup {
  color: string;
  ramps: SurfRampData[];
}

function groupByColor(ramps: SurfRampData[]): RampGroup[] {
  const groups = new Map<string, RampGroup>();

  for (const ramp of ramps) {
    const color = ramp.color ?? DEFAULT_RAMP_COLOR;
    let group = groups.get(color);
    if (!group) {
      group = { color, ramps: [] };
      groups.set(color, group);
    }
    group.ramps.push(ramp);
  }

  return Array.from(groups.values());
}

const _boxGeometry = new BoxGeometry(1, 1, 1);
const _rampEuler = new Euler();

function InstancedRampGroup({ group }: { group: RampGroup }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < group.ramps.length; i++) {
      const ramp = group.ramps[i];
      const rot = ramp.rotation;

      dummy.position.set(ramp.position[0], ramp.position[1], ramp.position[2]);
      _rampEuler.set(rot[0], rot[1], rot[2]);
      dummy.rotation.copy(_rampEuler);
      dummy.scale.set(ramp.size[0], ramp.size[1], ramp.size[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [group.ramps, dummy]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[_boxGeometry, undefined, group.ramps.length]}
      castShadow
      receiveShadow
      frustumCulled
    >
      <meshStandardMaterial color={group.color} />
    </instancedMesh>
  );
}

export interface InstancedSurfRampsProps {
  ramps: SurfRampData[];
}

export function InstancedSurfRamps({ ramps }: InstancedSurfRampsProps) {
  const groups = useMemo(() => groupByColor(ramps), [ramps]);

  // Batched physics colliders — single RigidBody with all ramp cuboids
  const colliders = useMemo(() => {
    return ramps.map((ramp) => {
      const half: Vec3 = [ramp.size[0] / 2, ramp.size[1] / 2, ramp.size[2] / 2];
      return { position: ramp.position, rotation: ramp.rotation, args: half };
    });
  }, [ramps]);

  return (
    <group>
      {groups.map((group) => (
        <InstancedRampGroup key={group.color} group={group} />
      ))}

      <RigidBody type="fixed" colliders={false}>
        {colliders.map((col, i) => (
          <CuboidCollider
            key={i}
            args={col.args}
            position={col.position}
            rotation={col.rotation}
          />
        ))}
      </RigidBody>
    </group>
  );
}
