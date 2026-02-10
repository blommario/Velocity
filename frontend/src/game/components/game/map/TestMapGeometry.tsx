/**
 * Static geometry for the test map — axis lines, sector markers, beacon
 * pillars, distance walls, platforms, ramp, corridor, and welcome arch.
 *
 * Depends on: testMapConfig (GRID, SECTOR_MARKERS, PILLAR_COLORS), @react-three/rapier
 * Used by: TestMap
 */
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { GRID, PILLAR_COLORS, SECTOR_MARKERS } from './testMapConfig';

/** Ground plane with physics collider. */
export function GroundPlane() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[200, 1, 200]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </RigidBody>
  );
}

/** Grid helper + colored axis strips on the ground plane. */
export function GridOverlay() {
  return (
    <>
      <gridHelper args={[GRID.SIZE, GRID.DIVISIONS, GRID.LINE_MAIN, GRID.LINE_SUB]} position={[0, 0.02, 0]} />
      <mesh position={[50, 0.03, 0]} receiveShadow><boxGeometry args={[100, 0.02, 0.3]} /><meshStandardMaterial color="#e74c3c" emissive="#e74c3c" emissiveIntensity={0.5} /></mesh>
      <mesh position={[-50, 0.03, 0]} receiveShadow><boxGeometry args={[100, 0.02, 0.3]} /><meshStandardMaterial color="#922b21" emissive="#922b21" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.03, 50]} receiveShadow><boxGeometry args={[0.3, 0.02, 100]} /><meshStandardMaterial color="#3498db" emissive="#3498db" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0, 0.03, -50]} receiveShadow><boxGeometry args={[0.3, 0.02, 100]} /><meshStandardMaterial color="#1a5276" emissive="#1a5276" emissiveIntensity={0.3} /></mesh>
    </>
  );
}

/** Colored pillars at sector origins (+X, -X, +Z, -Z, Origin). */
export function SectorMarkers() {
  return (
    <>
      {SECTOR_MARKERS.map((marker) => (
        <group key={marker.label}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.5, 5, 0.5]} position={[marker.position[0], 5, marker.position[2]]} />
            <mesh position={[marker.position[0], 5, marker.position[2]]} castShadow receiveShadow>
              <boxGeometry args={[1, 10, 1]} />
              <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.3} />
            </mesh>
          </RigidBody>
          <mesh position={[marker.position[0], 10.3, marker.position[2]]}>
            <boxGeometry args={[1.6, 0.3, 1.6]} />
            <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[marker.position[0], 0.04, marker.position[2]]}>
            <boxGeometry args={[3, 0.02, 3]} />
            <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Colored beacon pillars in a ring at radius 30u. */
export function BeaconPillars() {
  return (
    <>
      {PILLAR_COLORS.map((color, i) => {
        const angle = (i / PILLAR_COLORS.length) * Math.PI * 2;
        const r = 30;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        return (
          <group key={`pillar-${i}`}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.6, 6, 0.6]} position={[x, 6, z]} />
              <mesh position={[x, 6, z]} castShadow receiveShadow>
                <boxGeometry args={[1.2, 12, 1.2]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
              </mesh>
            </RigidBody>
            <mesh position={[x, 12.5, z]}>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} />
            </mesh>
            <mesh position={[x, 0.04, z]}>
              <boxGeometry args={[2.5, 0.02, 2.5]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Distance marker walls along the +X axis. */
export function DistanceMarkers() {
  return (
    <>
      {[20, 40, 60, 80].map((dist) => (
        <RigidBody key={`dist-${dist}`} type="fixed" colliders={false}>
          <CuboidCollider args={[0.15, 1, 3]} position={[dist, 1, 0]} />
          <mesh position={[dist, 1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 2, 6]} />
            <meshStandardMaterial color="#e74c3c" emissive="#e74c3c" emissiveIntensity={0.2 + dist * 0.005} transparent opacity={0.8} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/** Staircase platforms rising along -X / -Z. */
export function ElevatedPlatforms() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((step) => (
        <Platform key={`step-${step}`} position={[-15 - step * 4, (step + 1) * 1.5, -15]} size={[3.5, 0.4, 3.5]} color={`hsl(${200 + step * 25}, 60%, ${40 + step * 5}%)`} />
      ))}
    </>
  );
}

/** Ramp, walls, corridor, and welcome arch. */
export function StructuralGeometry() {
  return (
    <>
      {/* Ramp */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3, 0.15, 10]} position={[20, 2.5, -20]} rotation={[-0.2, 0, 0]} />
        <mesh position={[20, 2.5, -20]} rotation={[-0.2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 0.3, 20]} />
          <meshStandardMaterial color="#5a7a4a" emissive="#5a7a4a" emissiveIntensity={0.15} />
        </mesh>
      </RigidBody>

      {/* Walls */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 3, 8]} position={[-8, 3, 20]} />
        <mesh position={[-8, 3, 20]} castShadow receiveShadow><boxGeometry args={[0.5, 6, 16]} /><meshStandardMaterial color="#4a4a6a" emissive="#4a4a6a" emissiveIntensity={0.1} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[8, 3, 0.25]} position={[0, 3, 28]} />
        <mesh position={[0, 3, 28]} castShadow receiveShadow><boxGeometry args={[16, 6, 0.5]} /><meshStandardMaterial color="#4a6a4a" emissive="#4a6a4a" emissiveIntensity={0.1} /></mesh>
      </RigidBody>

      {/* Corridor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 2.5, 20]} position={[48, 2.5, 0]} />
        <mesh position={[48, 2.5, 0]} castShadow><boxGeometry args={[0.5, 5, 40]} /><meshStandardMaterial color="#3d3d5c" /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 2.5, 20]} position={[53, 2.5, 0]} />
        <mesh position={[53, 2.5, 0]} castShadow><boxGeometry args={[0.5, 5, 40]} /><meshStandardMaterial color="#3d3d5c" /></mesh>
      </RigidBody>

      {/* Welcome arch */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 5, 0.5]} position={[-4, 5, -6]} />
        <mesh position={[-4, 5, -6]} castShadow receiveShadow><boxGeometry args={[1, 10, 1]} /><meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.4} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 5, 0.5]} position={[4, 5, -6]} />
        <mesh position={[4, 5, -6]} castShadow receiveShadow><boxGeometry args={[1, 10, 1]} /><meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.4} /></mesh>
      </RigidBody>
      <mesh position={[0, 10.5, -6]}><boxGeometry args={[9, 1, 1]} /><meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0, 0.04, -6]}><boxGeometry args={[8, 0.02, 2]} /><meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.8} /></mesh>
    </>
  );
}

function Platform({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
    </RigidBody>
  );
}
