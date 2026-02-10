/**
 * HUD visibility and scaling settings tab.
 *
 * Depends on: settingsStore, SettingsWidgets
 * Used by: SettingsScreen
 */
import { useSettingsStore } from '@game/stores/settingsStore';
import { SectionTitle, SubSectionTitle, SliderSetting, ToggleSetting } from './SettingsWidgets';

export function HudSettings() {
  const showSpeedMeter = useSettingsStore((s) => s.showSpeedMeter);
  const setShowSpeedMeter = useSettingsStore((s) => s.setShowSpeedMeter);
  const showTimer = useSettingsStore((s) => s.showTimer);
  const setShowTimer = useSettingsStore((s) => s.setShowTimer);
  const showCheckpoints = useSettingsStore((s) => s.showCheckpoints);
  const setShowCheckpoints = useSettingsStore((s) => s.setShowCheckpoints);
  const showTrackProgress = useSettingsStore((s) => s.showTrackProgress);
  const setShowTrackProgress = useSettingsStore((s) => s.setShowTrackProgress);
  const hudScale = useSettingsStore((s) => s.hudScale);
  const setHudScale = useSettingsStore((s) => s.setHudScale);
  const hudOpacity = useSettingsStore((s) => s.hudOpacity);
  const setHudOpacity = useSettingsStore((s) => s.setHudOpacity);

  return (
    <div className="space-y-4">
      <SectionTitle>HUD</SectionTitle>
      <SliderSetting label="Scale" value={hudScale} min={0.5} max={2.0} step={0.1} onChange={setHudScale} displayValue={`${Math.round(hudScale * 100)}%`} />
      <SliderSetting label="Opacity" value={hudOpacity} min={0.1} max={1.0} step={0.05} onChange={setHudOpacity} displayValue={`${Math.round(hudOpacity * 100)}%`} />

      <div className="pt-4">
        <SubSectionTitle>Elements</SubSectionTitle>
      </div>
      <ToggleSetting label="Speed Meter" value={showSpeedMeter} onChange={setShowSpeedMeter} />
      <ToggleSetting label="Timer" value={showTimer} onChange={setShowTimer} />
      <ToggleSetting label="Checkpoints" value={showCheckpoints} onChange={setShowCheckpoints} />
      <ToggleSetting label="Track Progress" value={showTrackProgress} onChange={setShowTrackProgress} />
    </div>
  );
}
