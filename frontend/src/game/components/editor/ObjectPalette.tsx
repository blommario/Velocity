/**
 * Sidebar palette listing placeable object types grouped by category.
 * Clicking an item sets the active placement type in the editor store.
 *
 * Depends on: @game/stores/editorStore
 * Used by: MapEditor
 */
import { useEditorStore, EDITOR_OBJECT_TYPES, type EditorObjectType } from '@game/stores/editorStore';

const PALETTE_ITEMS: { type: EditorObjectType; label: string; color: string; group: string }[] = [
  // Geometry
  { type: EDITOR_OBJECT_TYPES.BLOCK, label: 'Block', color: '#808080', group: 'Geometry' },
  { type: EDITOR_OBJECT_TYPES.SURF_RAMP, label: 'Surf Ramp', color: '#4488cc', group: 'Geometry' },

  // Zones
  { type: EDITOR_OBJECT_TYPES.CHECKPOINT, label: 'Checkpoint', color: '#00aaff', group: 'Zones' },
  { type: EDITOR_OBJECT_TYPES.FINISH, label: 'Finish', color: '#00ff00', group: 'Zones' },
  { type: EDITOR_OBJECT_TYPES.KILL_ZONE, label: 'Kill Zone', color: '#ff0000', group: 'Zones' },

  // Pads & Gates
  { type: EDITOR_OBJECT_TYPES.BOOST_PAD, label: 'Boost Pad', color: '#ffaa00', group: 'Pads' },
  { type: EDITOR_OBJECT_TYPES.LAUNCH_PAD, label: 'Launch Pad', color: '#ff4400', group: 'Pads' },
  { type: EDITOR_OBJECT_TYPES.SPEED_GATE, label: 'Speed Gate', color: '#00ffff', group: 'Pads' },

  // Pickups & Points
  { type: EDITOR_OBJECT_TYPES.AMMO_PICKUP, label: 'Ammo Pickup', color: '#ff6600', group: 'Items' },
  { type: EDITOR_OBJECT_TYPES.GRAPPLE_POINT, label: 'Grapple Point', color: '#ff00ff', group: 'Items' },

  // Dynamic
  { type: EDITOR_OBJECT_TYPES.MOVING_PLATFORM, label: 'Moving Platform', color: '#666666', group: 'Dynamic' },
];

// Group items
const GROUPS = [...new Set(PALETTE_ITEMS.map((p) => p.group))];

export function ObjectPalette() {
  const placeObjectType = useEditorStore((s) => s.placeObjectType);
  const setPlaceObjectType = useEditorStore((s) => s.setPlaceObjectType);

  return (
    <div className="w-48 bg-gray-900 border-r border-gray-700 overflow-y-auto text-xs">
      <div className="p-2 text-gray-400 uppercase tracking-wider font-bold border-b border-gray-800">
        Objects
      </div>
      {GROUPS.map((group) => (
        <div key={group}>
          <div className="px-2 py-1 text-gray-500 uppercase tracking-wider text-[10px] mt-1">
            {group}
          </div>
          {PALETTE_ITEMS.filter((p) => p.group === group).map((item) => (
            <button
              key={item.type}
              onClick={() => setPlaceObjectType(item.type)}
              className={`w-full text-left px-2 py-1.5 flex items-center gap-2 transition-colors cursor-pointer ${
                placeObjectType === item.type
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
