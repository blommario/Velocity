/**
 * Re-exports editor store and types from the engine for game-layer consumption.
 *
 * Depends on: @engine/stores/editorStore
 * Used by: MapEditor, EditorGizmo, EditorViewport, ObjectPalette, SpawnMarker
 */
// Re-export from engine for backward compatibility
export {
  useEditorStore,
  EDITOR_OBJECT_TYPES,
  EDITOR_TOOLS,
  LIGHTING_PRESETS,
  LIGHTING_PRESET_DATA,
  type EditorObjectType,
  type EditorTool,
  type LightingPreset,
  type EditorObject,
} from '@engine/stores/editorStore';
