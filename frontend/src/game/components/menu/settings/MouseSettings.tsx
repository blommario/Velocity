/**
 * Mouse sensitivity settings tab.
 *
 * Depends on: settingsStore, SettingsWidgets
 * Used by: SettingsScreen
 */
import { useSettingsStore } from '@game/stores/settingsStore';
import { SectionTitle, SliderSetting } from './SettingsWidgets';

export function MouseSettings() {
  const sensitivity = useSettingsStore((s) => s.sensitivity);
  const setSensitivity = useSettingsStore((s) => s.setSensitivity);

  return (
    <div className="space-y-4">
      <SectionTitle>Mouse</SectionTitle>
      <SliderSetting
        label="Sensitivity"
        value={sensitivity}
        min={0.1}
        max={10}
        step={0.1}
        onChange={setSensitivity}
        displayValue={sensitivity.toFixed(1)}
      />
    </div>
  );
}
