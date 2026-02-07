import { Canvas } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EditorCamera } from './EditorCamera';
import { EditorObjects } from './EditorObjects';
import { EditorGizmo } from './EditorGizmo';
import { useEditorStore } from '../../stores/editorStore';
import { SpawnMarker } from './SpawnMarker';

export function EditorViewport() {
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const lighting = useEditorStore((s) => s.lighting);
  const backgroundColor = useEditorStore((s) => s.backgroundColor);

  return (
    <Canvas
      gl={async (canvas) => {
        const renderer = new WebGPURenderer({ canvas: canvas as HTMLCanvasElement, antialias: true });
        await renderer.init();
        return renderer;
      }}
      camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 20, 30] }}
      style={{ background: backgroundColor }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <EditorCamera />

      {/* Lighting */}
      <ambientLight
        intensity={lighting.ambientIntensity}
        color={lighting.ambientColor ?? '#ffffff'}
      />
      <directionalLight
        intensity={lighting.directionalIntensity}
        color={lighting.directionalColor ?? '#ffffff'}
        position={lighting.directionalPosition ?? [50, 100, 50]}
        castShadow
      />
      {lighting.hemisphereIntensity && (
        <hemisphereLight
          intensity={lighting.hemisphereIntensity}
          color={lighting.hemisphereSky ?? '#87CEEB'}
          groundColor={lighting.hemisphereGround ?? '#8B7355'}
        />
      )}

      {/* Grid */}
      {gridVisible && (
        <Grid
          args={[200, 200]}
          cellSize={2}
          cellColor="#444444"
          sectionSize={8}
          sectionColor="#666666"
          fadeDistance={150}
          position={[0, 0, 0]}
        />
      )}

      {/* Spawn marker */}
      <SpawnMarker />

      {/* All editor objects */}
      <EditorObjects />

      {/* Transform gizmo for selected object */}
      <EditorGizmo />

      {/* Navigation gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport />
      </GizmoHelper>
    </Canvas>
  );
}
