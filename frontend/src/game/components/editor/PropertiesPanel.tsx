/**
 * Editor properties panel — displays and edits properties of the selected
 * map object (block, checkpoint, zone, etc.) with type-specific fields.
 *
 * Depends on: editorStore, PropertyInputs
 * Used by: MapEditor
 */
import { useEditorStore, type EditorObject } from '@game/stores/editorStore';
import type {
  MapBlock, CheckpointData,
  BoostPadData, SpeedGateData, AmmoPickupData,
  MovingPlatformData, Vec3, BlockShape,
} from '../game/map/types';
import type { WeaponType } from '../game/physics/types';
import { PropVec3, Vec3Input, PropNumber, PropColor, PropSelect, PropCheck } from './PropertyInputs';

const BLOCK_SHAPES: BlockShape[] = ['box', 'ramp', 'cylinder', 'wedge'];
const WEAPON_TYPES: WeaponType[] = ['rocket', 'grenade'];

export function PropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const objects = useEditorStore((s) => s.objects);
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeObject = useEditorStore((s) => s.removeObject);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const spawnPoint = useEditorStore((s) => s.spawnPoint);
  const setSpawnPoint = useEditorStore((s) => s.setSpawnPoint);
  const validationErrors = useEditorStore((s) => s.validationErrors);

  const selected = selectedId ? objects.find((o) => o.id === selectedId) : null;

  return (
    <div className="w-56 bg-gray-900 border-l border-gray-700 overflow-y-auto text-xs">
      <div className="p-2 text-gray-400 uppercase tracking-wider font-bold border-b border-gray-800">
        Properties
      </div>

      {/* Spawn point (always visible) */}
      <div className="p-2 border-b border-gray-800">
        <label className="text-gray-500 text-[10px] uppercase">Spawn Point</label>
        <Vec3Input value={spawnPoint} onChange={setSpawnPoint} />
      </div>

      {selected ? (
        <ObjectProperties
          obj={selected}
          onUpdate={(data) => updateObject(selected.id, data)}
          onRemove={() => removeObject(selected.id)}
          onDuplicate={() => duplicateObject(selected.id)}
        />
      ) : (
        <div className="p-2 text-gray-500 text-center mt-4">
          Select an object to edit
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="p-2 border-t border-gray-800 mt-auto">
          <label className="text-red-400 text-[10px] uppercase font-bold">Errors</label>
          {validationErrors.map((err, i) => (
            <div key={i} className="text-red-300 text-[10px] mt-1">{err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectProperties({ obj, onUpdate, onRemove, onDuplicate }: {
  obj: EditorObject;
  onUpdate: (data: Partial<EditorObject['data']>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="p-2 space-y-2">
      <div className="text-white font-bold capitalize mb-2">{obj.type}</div>

      {'position' in obj.data && (
        <PropVec3 label="Position" value={(obj.data as { position: Vec3 }).position} onChange={(v) => onUpdate({ position: v })} />
      )}
      {'size' in obj.data && (
        <PropVec3 label="Size" value={(obj.data as { size: Vec3 }).size} onChange={(v) => onUpdate({ size: v })} />
      )}
      {'rotation' in obj.data && obj.data.rotation && (
        <PropVec3 label="Rotation" value={obj.data.rotation as Vec3} onChange={(v) => onUpdate({ rotation: v })} />
      )}

      {obj.type === 'block' && <BlockProps data={obj.data as MapBlock} onUpdate={onUpdate} />}
      {obj.type === 'checkpoint' && (
        <PropNumber label="Index" value={(obj.data as CheckpointData).index} onChange={(v) => onUpdate({ index: Math.round(v) })} min={0} step={1} />
      )}
      {'direction' in obj.data && (
        <PropVec3 label="Direction" value={(obj.data as BoostPadData).direction} onChange={(v) => onUpdate({ direction: v })} />
      )}
      {'speed' in obj.data && typeof (obj.data as BoostPadData).speed === 'number' && (
        <PropNumber label="Speed" value={(obj.data as BoostPadData).speed ?? 400} onChange={(v) => onUpdate({ speed: v })} min={0} step={50} />
      )}
      {obj.type === 'speedGate' && <SpeedGateProps data={obj.data as SpeedGateData} onUpdate={onUpdate} />}
      {obj.type === 'ammoPickup' && <AmmoPickupProps data={obj.data as AmmoPickupData} onUpdate={onUpdate} />}
      {obj.type === 'movingPlatform' && <MovingPlatformProps data={obj.data as MovingPlatformData} onUpdate={onUpdate} />}
      {'color' in obj.data && obj.type !== 'block' && (
        <PropColor label="Color" value={(obj.data as { color?: string }).color ?? '#ffffff'} onChange={(v) => onUpdate({ color: v })} />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-2 border-t border-gray-800">
        <button onClick={onDuplicate} className="flex-1 bg-blue-600/50 hover:bg-blue-500 text-white py-1 rounded transition-colors cursor-pointer">Duplicate</button>
        <button onClick={onRemove} className="flex-1 bg-red-600/50 hover:bg-red-500 text-white py-1 rounded transition-colors cursor-pointer">Delete</button>
      </div>
    </div>
  );
}

function BlockProps({ data, onUpdate }: { data: MapBlock; onUpdate: (d: Partial<MapBlock>) => void }) {
  return (
    <>
      <PropSelect label="Shape" value={data.shape} options={BLOCK_SHAPES} onChange={(v) => onUpdate({ shape: v as BlockShape })} />
      <PropColor label="Color" value={data.color} onChange={(v) => onUpdate({ color: v })} />
      <PropColor label="Emissive" value={data.emissive ?? '#000000'} onChange={(v) => onUpdate({ emissive: v })} />
      <PropNumber label="Emissive Int." value={data.emissiveIntensity ?? 0} onChange={(v) => onUpdate({ emissiveIntensity: v })} min={0} max={2} step={0.1} />
      <PropCheck label="Transparent" value={data.transparent ?? false} onChange={(v) => onUpdate({ transparent: v })} />
      {data.transparent && (
        <PropNumber label="Opacity" value={data.opacity ?? 1} onChange={(v) => onUpdate({ opacity: v })} min={0} max={1} step={0.1} />
      )}
    </>
  );
}

function SpeedGateProps({ data, onUpdate }: { data: SpeedGateData; onUpdate: (d: Partial<SpeedGateData>) => void }) {
  return (
    <>
      <PropNumber label="Multiplier" value={data.multiplier ?? 1.5} onChange={(v) => onUpdate({ multiplier: v })} min={0.1} max={5} step={0.1} />
      <PropNumber label="Min Speed" value={data.minSpeed ?? 400} onChange={(v) => onUpdate({ minSpeed: v })} min={0} step={50} />
    </>
  );
}

function AmmoPickupProps({ data, onUpdate }: { data: AmmoPickupData; onUpdate: (d: Partial<AmmoPickupData>) => void }) {
  return (
    <>
      <PropSelect label="Weapon" value={data.weaponType} options={WEAPON_TYPES} onChange={(v) => onUpdate({ weaponType: v as WeaponType })} />
      <PropNumber label="Amount" value={data.amount} onChange={(v) => onUpdate({ amount: Math.round(v) })} min={1} max={10} step={1} />
    </>
  );
}

function MovingPlatformProps({ data, onUpdate }: { data: MovingPlatformData; onUpdate: (d: Partial<MovingPlatformData>) => void }) {
  return (
    <>
      <PropNumber label="Speed" value={data.speed} onChange={(v) => onUpdate({ speed: v })} min={0.5} step={0.5} />
      <PropNumber label="Pause Time" value={data.pauseTime ?? 0} onChange={(v) => onUpdate({ pauseTime: v })} min={0} step={0.5} />
      <div className="mt-1">
        <label className="text-gray-500 text-[10px] uppercase">Waypoints</label>
        {data.waypoints.map((wp, i) => (
          <div key={i} className="flex items-center gap-1 mt-1">
            <span className="text-gray-600 w-4">{i}</span>
            <Vec3Input
              value={wp}
              onChange={(v) => {
                const wps = [...data.waypoints];
                wps[i] = v;
                onUpdate({ waypoints: wps });
              }}
            />
          </div>
        ))}
        <button
          className="mt-1 text-green-400 hover:text-green-300 cursor-pointer"
          onClick={() => {
            const wps = [...data.waypoints];
            const last = wps[wps.length - 1] ?? [0, 0, 0];
            wps.push([last[0] + 5, last[1], last[2]]);
            onUpdate({ waypoints: wps });
          }}
        >
          + Add Waypoint
        </button>
      </div>
    </>
  );
}
