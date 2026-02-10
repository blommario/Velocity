/**
 * Editor viewport object renderer — handles click-to-select, placement,
 * and delegates visual rendering to EditorObjectMesh.
 *
 * Depends on: editorStore, editorMeshes
 * Used by: MapEditor viewport
 */
import { type ThreeEvent } from '@react-three/fiber';
import { useEditorStore, EDITOR_TOOLS } from '@game/stores/editorStore';
import type { Vec3 } from '../game/map/types';
import { EditorObjectMesh } from './editorMeshes';

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function EditorObjects() {
  const objects = useEditorStore((s) => s.objects);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectObject = useEditorStore((s) => s.selectObject);
  const activeTool = useEditorStore((s) => s.activeTool);
  const addObject = useEditorStore((s) => s.addObject);
  const placeObjectType = useEditorStore((s) => s.placeObjectType);
  const gridSize = useEditorStore((s) => s.gridSize);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);

  const handleClick = (e: ThreeEvent<MouseEvent>, id: string) => {
    e.stopPropagation();
    if (activeTool === EDITOR_TOOLS.SELECT || activeTool === EDITOR_TOOLS.MOVE ||
        activeTool === EDITOR_TOOLS.ROTATE || activeTool === EDITOR_TOOLS.SCALE) {
      selectObject(id);
    }
  };

  const handleMissClick = (e: ThreeEvent<MouseEvent>) => {
    if (activeTool === EDITOR_TOOLS.PLACE) {
      const point = e.point;
      const pos: Vec3 = snapToGrid
        ? [snap(point.x, gridSize), snap(point.y, gridSize), snap(point.z, gridSize)]
        : [round2(point.x), round2(point.y), round2(point.z)];
      addObject(placeObjectType, pos);
    } else {
      selectObject(null);
    }
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={handleMissClick}>
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {objects.map((obj) => (
        <EditorObjectMesh
          key={obj.id}
          obj={obj}
          isSelected={obj.id === selectedId}
          onClick={(e) => handleClick(e, obj.id)}
        />
      ))}
    </group>
  );
}
