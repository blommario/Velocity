import { useEffect } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useCombatStore } from '../../../stores/combatStore';

interface GrapplePointProps {
  position: [number, number, number];
}

export function GrapplePoint({ position }: GrapplePointProps) {
  useEffect(() => {
    useCombatStore.getState().registerGrapplePoint(position);
    return () => {
      useCombatStore.getState().unregisterGrapplePoint(position);
    };
  }, [position]);

  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.5, 0.5, 0.5]} />
      <mesh>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial
          color="#ffcc00"
          emissive="#ffcc00"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.05, 6, 16]} />
        <meshStandardMaterial
          color="#ffcc00"
          emissive="#ffcc00"
          emissiveIntensity={1.5}
          transparent
          opacity={0.4}
        />
      </mesh>
    </RigidBody>
  );
}
