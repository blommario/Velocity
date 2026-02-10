import { useEditorStore, type EditorObject } from '@game/stores/editorStore';
import type {
  MapBlock, CheckpointData, FinishZoneData, KillZoneData,
  BoostPadData, LaunchPadData, SpeedGateData, AmmoPickupData,
  GrapplePointData, SurfRampData, MovingPlatformData, Vec3, BlockShape,
} from '../game/map/types';
import type { WeaponType } from '../game/physics/types';

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

      {/* Position (most objects have it) */}
      {'position' in obj.data && (
        <PropVec3 label="Position" value={(obj.data as { position: Vec3 }).position} onChange={(v) => onUpdate({ position: v })} />
      )}

      {/* Size */}
      {'size' in obj.data && (
        <PropVec3 label="Size" value={(obj.data as { size: Vec3 }).size} onChange={(v) => onUpdate({ size: v })} />
      )}

      {/* Rotation */}
      {'rotation' in obj.data && obj.data.rotation && (
        <PropVec3 label="Rotation" value={obj.data.rotation as Vec3} onChange={(v) => onUpdate({ rotation: v })} />
      )}

      {/* Block-specific */}
      {obj.type === 'block' && (
        <>
          <PropSelect
            label="Shape"
            value={(obj.data as MapBlock).shape}
            options={BLOCK_SHAPES}
            onChange={(v) => onUpdate({ shape: v as BlockShape })}
          />
          <PropColor label="Color" value={(obj.data as MapBlock).color} onChange={(v) => onUpdate({ color: v })} />
          <PropColor label="Emissive" value={(obj.data as MapBlock).emissive ?? '#000000'} onChange={(v) => onUpdate({ emissive: v })} />
          <PropNumber label="Emissive Int." value={(obj.data as MapBlock).emissiveIntensity ?? 0} onChange={(v) => onUpdate({ emissiveIntensity: v })} min={0} max={2} step={0.1} />
          <PropCheck label="Transparent" value={(obj.data as MapBlock).transparent ?? false} onChange={(v) => onUpdate({ transparent: v })} />
          {(obj.data as MapBlock).transparent && (
            <PropNumber label="Opacity" value={(obj.data as MapBlock).opacity ?? 1} onChange={(v) => onUpdate({ opacity: v })} min={0} max={1} step={0.1} />
          )}
        </>
      )}

      {/* Checkpoint index */}
      {obj.type === 'checkpoint' && (
        <PropNumber label="Index" value={(obj.data as CheckpointData).index} onChange={(v) => onUpdate({ index: Math.round(v) })} min={0} step={1} />
      )}

      {/* Direction (boost/launch) */}
      {'direction' in obj.data && (
        <PropVec3 label="Direction" value={(obj.data as BoostPadData).direction} onChange={(v) => onUpdate({ direction: v })} />
      )}

      {/* Speed (boost/launch) */}
      {'speed' in obj.data && typeof (obj.data as BoostPadData).speed === 'number' && (
        <PropNumber label="Speed" value={(obj.data as BoostPadData).speed ?? 400} onChange={(v) => onUpdate({ speed: v })} min={0} step={50} />
      )}

      {/* Speed gate specifics */}
      {obj.type === 'speedGate' && (
        <>
          <PropNumber label="Multiplier" value={(obj.data as SpeedGateData).multiplier ?? 1.5} onChange={(v) => onUpdate({ multiplier: v })} min={0.1} max={5} step={0.1} />
          <PropNumber label="Min Speed" value={(obj.data as SpeedGateData).minSpeed ?? 400} onChange={(v) => onUpdate({ minSpeed: v })} min={0} step={50} />
        </>
      )}

      {/* Ammo pickup */}
      {obj.type === 'ammoPickup' && (
        <>
          <PropSelect
            label="Weapon"
            value={(obj.data as AmmoPickupData).weaponType}
            options={WEAPON_TYPES}
            onChange={(v) => onUpdate({ weaponType: v as WeaponType })}
          />
          <PropNumber label="Amount" value={(obj.data as AmmoPickupData).amount} onChange={(v) => onUpdate({ amount: Math.round(v) })} min={1} max={10} step={1} />
        </>
      )}

      {/* Moving platform */}
      {obj.type === 'movingPlatform' && (
        <>
          <PropNumber label="Speed" value={(obj.data as MovingPlatformData).speed} onChange={(v) => onUpdate({ speed: v })} min={0.5} step={0.5} />
          <PropNumber label="Pause Time" value={(obj.data as MovingPlatformData).pauseTime ?? 0} onChange={(v) => onUpdate({ pauseTime: v })} min={0} step={0.5} />
          <div className="mt-1">
            <label className="text-gray-500 text-[10px] uppercase">Waypoints</label>
            {(obj.data as MovingPlatformData).waypoints.map((wp, i) => (
              <div key={i} className="flex items-center gap-1 mt-1">
                <span className="text-gray-600 w-4">{i}</span>
                <Vec3Input
                  value={wp}
                  onChange={(v) => {
                    const wps = [...(obj.data as MovingPlatformData).waypoints];
                    wps[i] = v;
                    onUpdate({ waypoints: wps });
                  }}
                />
              </div>
            ))}
            <button
              className="mt-1 text-green-400 hover:text-green-300 cursor-pointer"
              onClick={() => {
                const wps = [...(obj.data as MovingPlatformData).waypoints];
                const last = wps[wps.length - 1] ?? [0, 0, 0];
                wps.push([last[0] + 5, last[1], last[2]]);
                onUpdate({ waypoints: wps });
              }}
            >
              + Add Waypoint
            </button>
          </div>
        </>
      )}

      {/* Color (for objects with optional color) */}
      {'color' in obj.data && obj.type !== 'block' && (
        <PropColor label="Color" value={(obj.data as { color?: string }).color ?? '#ffffff'} onChange={(v) => onUpdate({ color: v })} />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-2 border-t border-gray-800">
        <button
          onClick={onDuplicate}
          className="flex-1 bg-blue-600/50 hover:bg-blue-500 text-white py-1 rounded transition-colors cursor-pointer"
        >
          Duplicate
        </button>
        <button
          onClick={onRemove}
          className="flex-1 bg-red-600/50 hover:bg-red-500 text-white py-1 rounded transition-colors cursor-pointer"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Shared property inputs ──

function PropVec3({ label, value, onChange }: { label: string; value: Vec3; onChange: (v: Vec3) => void }) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] uppercase">{label}</label>
      <Vec3Input value={value} onChange={onChange} />
    </div>
  );
}

function Vec3Input({ value, onChange }: { value: Vec3; onChange: (v: Vec3) => void }) {
  return (
    <div className="flex gap-1">
      {(['x', 'y', 'z'] as const).map((axis, i) => (
        <input
          key={axis}
          type="number"
          value={value[i]}
          onChange={(e) => {
            const v = [...value] as Vec3;
            v[i] = parseFloat(e.target.value) || 0;
            onChange(v);
          }}
          className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-white text-center"
          step="0.5"
        />
      ))}
    </div>
  );
}

function PropNumber({ label, value, onChange, min, max, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] uppercase">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white"
      />
    </div>
  );
}

function PropColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-gray-500 text-[10px] uppercase flex-1">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-5 rounded border border-gray-700 cursor-pointer bg-transparent"
      />
    </div>
  );
}

function PropSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function PropCheck({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-700"
      />
      <span className="text-gray-400">{label}</span>
    </label>
  );
}
