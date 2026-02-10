/**
 * Editor 3D mesh representations for each map object type — visual previews
 * with selection highlighting for the map editor viewport.
 *
 * Depends on: (map types only)
 * Used by: EditorObjects
 */
import { type ThreeEvent } from '@react-three/fiber';
import type {
  MapBlock, CheckpointData, FinishZoneData, KillZoneData,
  BoostPadData, LaunchPadData, SpeedGateData, AmmoPickupData,
  GrapplePointData, SurfRampData, MovingPlatformData, Vec3,
} from '../game/map/types';
import type { EditorObject } from '@game/stores/editorStore';

const SELECTION_COLOR = '#ffff00';
const SELECTION_EMISSIVE_INTENSITY = 0.3;

export function EditorObjectMesh({ obj, isSelected, onClick }: {
  obj: EditorObject;
  isSelected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  switch (obj.type) {
    case 'block': return <BlockMesh data={obj.data as MapBlock} isSelected={isSelected} onClick={onClick} />;
    case 'checkpoint': return <ZoneMesh data={obj.data as CheckpointData} color="#00aaff" label={`CP ${(obj.data as CheckpointData).index}`} isSelected={isSelected} onClick={onClick} />;
    case 'finish': return <ZoneMesh data={obj.data as FinishZoneData} color="#00ff00" label="FINISH" isSelected={isSelected} onClick={onClick} />;
    case 'killZone': return <ZoneMesh data={obj.data as KillZoneData} color="#ff0000" label="KILL" isSelected={isSelected} onClick={onClick} />;
    case 'boostPad': return <PadMesh data={obj.data as BoostPadData} color={((obj.data as BoostPadData).color) ?? '#ffaa00'} isSelected={isSelected} onClick={onClick} />;
    case 'launchPad': return <PadMesh data={obj.data as LaunchPadData} color={((obj.data as LaunchPadData).color) ?? '#ff4400'} isSelected={isSelected} onClick={onClick} />;
    case 'speedGate': return <GateMesh data={obj.data as SpeedGateData} isSelected={isSelected} onClick={onClick} />;
    case 'ammoPickup': return <PickupMesh data={obj.data as AmmoPickupData} isSelected={isSelected} onClick={onClick} />;
    case 'grapplePoint': return <GrappleMesh data={obj.data as GrapplePointData} isSelected={isSelected} onClick={onClick} />;
    case 'surfRamp': return <SurfMesh data={obj.data as SurfRampData} isSelected={isSelected} onClick={onClick} />;
    case 'movingPlatform': return <PlatformMesh data={obj.data as MovingPlatformData} isSelected={isSelected} onClick={onClick} />;
    default: return null;
  }
}

function BlockMesh({ data, isSelected, onClick }: { data: MapBlock; isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh position={data.position} rotation={data.rotation ?? [0, 0, 0]} onClick={onClick}>
      {data.shape === 'cylinder' ? (
        <cylinderGeometry args={[data.size[0] / 2, data.size[0] / 2, data.size[1], 32]} />
      ) : (
        <boxGeometry args={data.size} />
      )}
      <meshStandardMaterial
        color={isSelected ? SELECTION_COLOR : data.color}
        emissive={isSelected ? SELECTION_COLOR : (data.emissive ?? '#000000')}
        emissiveIntensity={isSelected ? SELECTION_EMISSIVE_INTENSITY : (data.emissiveIntensity ?? 0)}
        transparent={data.transparent ?? isSelected}
        opacity={isSelected ? 0.8 : (data.opacity ?? 1)}
      />
    </mesh>
  );
}

function ZoneMesh({ data, color, label: _label, isSelected, onClick }: {
  data: { position: Vec3; size: Vec3 }; color: string; label: string;
  isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <mesh position={data.position} onClick={onClick}>
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={isSelected ? SELECTION_COLOR : color} transparent opacity={0.3} wireframe={!isSelected} />
    </mesh>
  );
}

function PadMesh({ data, color, isSelected, onClick }: {
  data: BoostPadData | LaunchPadData; color: string;
  isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const size = data.size ?? [2, 0.2, 2];
  return (
    <mesh position={data.position} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={isSelected ? SELECTION_COLOR : color} emissive={isSelected ? SELECTION_COLOR : color} emissiveIntensity={isSelected ? 0.5 : 0.3} />
    </mesh>
  );
}

function GateMesh({ data, isSelected, onClick }: { data: SpeedGateData; isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const size = data.size ?? [6, 6, 1];
  return (
    <mesh position={data.position} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={isSelected ? SELECTION_COLOR : (data.color ?? '#00ffff')} transparent opacity={0.25} emissive={isSelected ? SELECTION_COLOR : (data.color ?? '#00ffff')} emissiveIntensity={0.3} />
    </mesh>
  );
}

function PickupMesh({ data, isSelected, onClick }: { data: AmmoPickupData; isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const color = data.weaponType === 'rocket' ? '#ff6600' : '#44ff44';
  return (
    <mesh position={data.position} onClick={onClick}>
      <octahedronGeometry args={[0.5]} />
      <meshStandardMaterial color={isSelected ? SELECTION_COLOR : color} emissive={isSelected ? SELECTION_COLOR : color} emissiveIntensity={0.4} />
    </mesh>
  );
}

function GrappleMesh({ data, isSelected, onClick }: { data: GrapplePointData; isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh position={data.position} onClick={onClick}>
      <sphereGeometry args={[0.6, 16, 16]} />
      <meshStandardMaterial color={isSelected ? SELECTION_COLOR : '#ff00ff'} emissive={isSelected ? SELECTION_COLOR : '#ff00ff'} emissiveIntensity={0.5} />
    </mesh>
  );
}

function SurfMesh({ data, isSelected, onClick }: { data: SurfRampData; isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh position={data.position} rotation={data.rotation} onClick={onClick}>
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={isSelected ? SELECTION_COLOR : (data.color ?? '#4488cc')} transparent opacity={0.7} />
    </mesh>
  );
}

function PlatformMesh({ data, isSelected, onClick }: { data: MovingPlatformData; isSelected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const firstWaypoint = data.waypoints[0] ?? [0, 0, 0];
  return (
    <group>
      <mesh position={firstWaypoint} onClick={onClick}>
        <boxGeometry args={data.size} />
        <meshStandardMaterial color={isSelected ? SELECTION_COLOR : (data.color ?? '#666666')} />
      </mesh>
      {data.waypoints.length > 1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(data.waypoints.flat()), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={isSelected ? SELECTION_COLOR : '#ffff00'} />
        </line>
      )}
    </group>
  );
}
