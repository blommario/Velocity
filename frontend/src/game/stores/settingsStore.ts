/**
 * Re-exports settings store and configuration types from the engine.
 *
 * Depends on: @engine/stores/settingsStore
 * Used by: usePhysicsTick, SpeedTrail, SystemStatus, SettingsScreen
 */
// Re-export from engine for backward compatibility
export {
  useSettingsStore,
  DEFAULT_KEY_BINDINGS,
  CROSSHAIR_STYLES,
  QUALITY_PRESETS,
  type BindingAction,
  type CrosshairStyle,
  type QualityPreset,
} from '@engine/stores/settingsStore';
