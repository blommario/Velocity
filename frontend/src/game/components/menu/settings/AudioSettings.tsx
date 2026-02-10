/**
 * Audio volume settings tab (master, SFX, music, ambient).
 *
 * Depends on: settingsStore, SettingsWidgets
 * Used by: SettingsScreen
 */
import { useSettingsStore } from '@game/stores/settingsStore';
import { SectionTitle, SliderSetting } from './SettingsWidgets';

export function AudioSettings() {
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const ambientVolume = useSettingsStore((s) => s.ambientVolume);
  const setAmbientVolume = useSettingsStore((s) => s.setAmbientVolume);

  return (
    <div className="space-y-4">
      <SectionTitle>Audio</SectionTitle>
      <SliderSetting label="Master" value={masterVolume} min={0} max={1} step={0.05} onChange={setMasterVolume} displayValue={`${Math.round(masterVolume * 100)}%`} />
      <SliderSetting label="SFX" value={sfxVolume} min={0} max={1} step={0.05} onChange={setSfxVolume} displayValue={`${Math.round(sfxVolume * 100)}%`} />
      <SliderSetting label="Music" value={musicVolume} min={0} max={1} step={0.05} onChange={setMusicVolume} displayValue={`${Math.round(musicVolume * 100)}%`} />
      <SliderSetting label="Ambient" value={ambientVolume} min={0} max={1} step={0.05} onChange={setAmbientVolume} displayValue={`${Math.round(ambientVolume * 100)}%`} />
    </div>
  );
}
