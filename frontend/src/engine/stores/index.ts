/**
 * Stores barrel — devLog, settings, replay, and editor stores.
 *
 * Depends on: devLogStore, settingsStore, replayStore, editorStore
 * Used by: game layer, UI components
 */
export {
  useDevLogStore,
  devLog,
  installErrorCapture,
  type LogLevel,
  type LogEntry,
  type PerfMetrics,
} from './devLogStore';
export { PerfMonitor } from './PerfMonitor';
export { DevLogPanel } from './DevLogPanel';

// Settings
export {
  useSettingsStore,
  DEFAULT_KEY_BINDINGS,
  CROSSHAIR_STYLES,
  QUALITY_PRESETS,
  type BindingAction,
  type CrosshairStyle,
  type QualityPreset,
} from './settingsStore';

// Replay
export {
  useReplayStore,
  serializeReplay,
  deserializeReplay,
  type ReplayFrame,
  type ReplayData,
  type DeltaFrame,
} from './replayStore';

// Editor
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
} from './editorStore';
