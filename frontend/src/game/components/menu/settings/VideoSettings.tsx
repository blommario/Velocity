/**
 * Video and post-processing settings tab.
 *
 * Depends on: settingsStore, shadowConfig, SettingsWidgets
 * Used by: SettingsScreen
 */
import {
  useSettingsStore,
  QUALITY_PRESETS,
  type QualityPreset,
} from '@game/stores/settingsStore';
import { SHADOW_QUALITY_LEVELS, type ShadowQuality } from '@engine/rendering/shadowConfig';
import { SectionTitle, SubSectionTitle, SliderSetting, ToggleSetting, SelectSetting } from './SettingsWidgets';

export function VideoSettings() {
  const fov = useSettingsStore((s) => s.fov);
  const setFov = useSettingsStore((s) => s.setFov);
  const qualityPreset = useSettingsStore((s) => s.qualityPreset);
  const setQualityPreset = useSettingsStore((s) => s.setQualityPreset);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  const setShadowQuality = useSettingsStore((s) => s.setShadowQuality);
  const bloom = useSettingsStore((s) => s.bloom);
  const setBloom = useSettingsStore((s) => s.setBloom);
  const particles = useSettingsStore((s) => s.particles);
  const setParticles = useSettingsStore((s) => s.setParticles);
  const speedLines = useSettingsStore((s) => s.speedLines);
  const setSpeedLines = useSettingsStore((s) => s.setSpeedLines);
  const screenShake = useSettingsStore((s) => s.screenShake);
  const setScreenShake = useSettingsStore((s) => s.setScreenShake);
  const ssao = useSettingsStore((s) => s.ssao);
  const setSsao = useSettingsStore((s) => s.setSsao);
  const colorGrading = useSettingsStore((s) => s.colorGrading);
  const setColorGrading = useSettingsStore((s) => s.setColorGrading);
  const filmGrain = useSettingsStore((s) => s.filmGrain);
  const setFilmGrain = useSettingsStore((s) => s.setFilmGrain);
  const chromaticAberration = useSettingsStore((s) => s.chromaticAberration);
  const setChromaticAberration = useSettingsStore((s) => s.setChromaticAberration);
  const motionBlur = useSettingsStore((s) => s.motionBlur);
  const setMotionBlur = useSettingsStore((s) => s.setMotionBlur);
  const depthOfField = useSettingsStore((s) => s.depthOfField);
  const setDepthOfField = useSettingsStore((s) => s.setDepthOfField);

  return (
    <div className="space-y-4">
      <SectionTitle>Video</SectionTitle>
      <SliderSetting label="FOV" value={fov} min={80} max={130} step={1} onChange={setFov} displayValue={`${fov}`} />
      <SelectSetting
        label="Quality"
        value={qualityPreset}
        options={Object.values(QUALITY_PRESETS)}
        onChange={(v) => setQualityPreset(v as QualityPreset)}
      />
      <SelectSetting
        label="Shadows"
        value={shadowQuality}
        options={Object.values(SHADOW_QUALITY_LEVELS)}
        onChange={(v) => setShadowQuality(v as ShadowQuality)}
      />
      <ToggleSetting label="Bloom" value={bloom} onChange={setBloom} />
      <ToggleSetting label="Particles" value={particles} onChange={setParticles} />
      <ToggleSetting label="Speed Lines" value={speedLines} onChange={setSpeedLines} />
      <ToggleSetting label="Screen Shake" value={screenShake} onChange={setScreenShake} />

      <div className="pt-4">
        <SubSectionTitle>Post-Processing</SubSectionTitle>
      </div>
      <ToggleSetting label="SSAO" value={ssao} onChange={setSsao} />
      <ToggleSetting label="Color Grading" value={colorGrading} onChange={setColorGrading} />
      <ToggleSetting label="Film Grain" value={filmGrain} onChange={setFilmGrain} />
      <ToggleSetting label="Chromatic Aberration" value={chromaticAberration} onChange={setChromaticAberration} />
      <ToggleSetting label="Motion Blur" value={motionBlur} onChange={setMotionBlur} />
      <ToggleSetting label="Depth of Field" value={depthOfField} onChange={setDepthOfField} />
    </div>
  );
}
