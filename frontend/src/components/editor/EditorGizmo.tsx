import { useEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { useEditorStore, EDITOR_TOOLS } from '../../stores/editorStore';
import type { Vec3 } from '../game/map/types';
import type { Object3D } from 'three';

/** Transform gizmo for the currently selected editor object */
export function EditorGizmo() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const activeTool = useEditorStore((s) => s.activeTool);
  const objects = useEditorStore((s) => s.objects);
  const updateObject = useEditorStore((s) => s.updateObject);
  const gridSize = useEditorStore((s) => s.gridSize);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const meshRef = useRef<Object3D>(null);

  const selected = selectedId ? objects.find((o) => o.id === selectedId) : null;

  // Map editor tool to TransformControls mode
  const mode = activeTool === EDITOR_TOOLS.ROTATE ? 'rotate'
    : activeTool === EDITOR_TOOLS.SCALE ? 'scale'
    : 'translate';

  // Only show gizmo for move/rotate/scale tools
  const showGizmo = selected && (
    activeTool === EDITOR_TOOLS.MOVE ||
    activeTool === EDITOR_TOOLS.ROTATE ||
    activeTool === EDITOR_TOOLS.SCALE
  );

  // Set mesh position to selected object
  useEffect(() => {
    if (!meshRef.current || !selected) return;
    const data = selected.data;
    if ('position' in data) {
      const pos = (data as { position: Vec3 }).position;
      meshRef.current.position.set(pos[0], pos[1], pos[2]);
    }
    if ('rotation' in data && data.rotation) {
      const rot = data.rotation as Vec3;
      meshRef.current.rotation.set(rot[0], rot[1], rot[2]);
    }
    if ('size' in data) {
      const size = (data as { size: Vec3 }).size;
      meshRef.current.scale.set(size[0], size[1], size[2]);
    }
  }, [selected]);

  if (!showGizmo || !selected) return null;

  const handleChange = () => {
    if (!meshRef.current || !selected) return;
    const pos = meshRef.current.position;
    const rot = meshRef.current.rotation;
    const scale = meshRef.current.scale;

    const updates: Record<string, unknown> = {};

    if (mode === 'translate' && 'position' in selected.data) {
      const newPos: Vec3 = snapToGrid
        ? [snap(pos.x, gridSize), snap(pos.y, gridSize), snap(pos.z, gridSize)]
        : [round2(pos.x), round2(pos.y), round2(pos.z)];
      updates.position = newPos;
    }

    if (mode === 'rotate' && 'rotation' in selected.data) {
      updates.rotation = [round3(rot.x), round3(rot.y), round3(rot.z)] as Vec3;
    }

    if (mode === 'scale' && 'size' in selected.data) {
      const newSize: Vec3 = snapToGrid
        ? [Math.max(snap(scale.x, gridSize), gridSize), Math.max(snap(scale.y, gridSize), gridSize), Math.max(snap(scale.z, gridSize), gridSize)]
        : [Math.max(round2(scale.x), 0.1), Math.max(round2(scale.y), 0.1), Math.max(round2(scale.z), 0.1)];
      updates.size = newSize;
    }

    if (Object.keys(updates).length > 0) {
      updateObject(selected.id, updates);
    }
  };

  return (
    <TransformControls
      mode={mode}
      translationSnap={snapToGrid ? gridSize : undefined}
      rotationSnap={snapToGrid ? Math.PI / 12 : undefined}
      scaleSnap={snapToGrid ? gridSize : undefined}
      onMouseUp={handleChange}
    >
      <mesh ref={meshRef as React.RefObject<never>}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </TransformControls>
  );
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
