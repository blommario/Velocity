/**
 * Gameplay settings tab — bunny hop, edge grab, crosshair customization.
 *
 * Depends on: settingsStore, SettingsWidgets
 * Used by: SettingsScreen
 */
import {
  useSettingsStore,
  CROSSHAIR_STYLES,
  type CrosshairStyle,
} from '@game/stores/settingsStore';
import { SectionTitle, SubSectionTitle, SliderSetting, ToggleSetting, SelectSetting, ColorSetting } from './SettingsWidgets';

export function GameplaySettings() {
  const autoBhop = useSettingsStore((s) => s.autoBhop);
  const setAutoBhop = useSettingsStore((s) => s.setAutoBhop);
  const edgeGrab = useSettingsStore((s) => s.edgeGrab);
  const setEdgeGrab = useSettingsStore((s) => s.setEdgeGrab);
  const crosshairStyle = useSettingsStore((s) => s.crosshairStyle);
  const setCrosshairStyle = useSettingsStore((s) => s.setCrosshairStyle);
  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const setCrosshairColor = useSettingsStore((s) => s.setCrosshairColor);
  const crosshairSize = useSettingsStore((s) => s.crosshairSize);
  const setCrosshairSize = useSettingsStore((s) => s.setCrosshairSize);

  return (
    <div className="space-y-4">
      <SectionTitle>Gameplay</SectionTitle>
      <ToggleSetting label="Auto Bunny Hop" value={autoBhop} onChange={setAutoBhop} />
      <ToggleSetting label="Edge Grab" value={edgeGrab} onChange={setEdgeGrab} />

      <div className="pt-4">
        <SubSectionTitle>Crosshair</SubSectionTitle>
      </div>
      <SelectSetting
        label="Style"
        value={crosshairStyle}
        options={Object.values(CROSSHAIR_STYLES)}
        onChange={(v) => setCrosshairStyle(v as CrosshairStyle)}
      />
      <ColorSetting label="Color" value={crosshairColor} onChange={setCrosshairColor} />
      <SliderSetting label="Size" value={crosshairSize} min={1} max={20} step={1} onChange={setCrosshairSize} displayValue={`${crosshairSize}px`} />
    </div>
  );
}
