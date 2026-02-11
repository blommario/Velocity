/**
 * Visual wireframe capsule + ground ring marking the player spawn point.
 *
 * Depends on: @game/stores/editorStore
 * Used by: EditorViewport
 */
import { useEditorStore } from '@game/stores/editorStore';

/** Visual marker showing the player spawn point in the editor */
export function SpawnMarker() {
  const spawnPoint = useEditorStore((s) => s.spawnPoint);

  return (
    <group position={spawnPoint}>
      {/* Capsule representing player */}
      <mesh position={[0, 1, 0]}>
        <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
        <meshStandardMaterial color="#00ff88" wireframe opacity={0.6} transparent />
      </mesh>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color="#00ff88" />
      </mesh>
    </group>
  );
}
