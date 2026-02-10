/**
 * Camera settings tab — head bob, smoothing, FOV scaling, viewmodel, editor camera.
 *
 * Depends on: settingsStore, SettingsWidgets
 * Used by: SettingsScreen
 */
import { useSettingsStore } from '@game/stores/settingsStore';
import { SectionTitle, SubSectionTitle, SliderSetting, ToggleSetting } from './SettingsWidgets';

export function CameraSettings() {
  const headBob = useSettingsStore((s) => s.headBob);
  const setHeadBob = useSettingsStore((s) => s.setHeadBob);
  const cameraSmoothing = useSettingsStore((s) => s.cameraSmoothing);
  const setCameraSmoothing = useSettingsStore((s) => s.setCameraSmoothing);
  const viewmodelVisible = useSettingsStore((s) => s.viewmodelVisible);
  const setViewmodelVisible = useSettingsStore((s) => s.setViewmodelVisible);
  const viewmodelBob = useSettingsStore((s) => s.viewmodelBob);
  const setViewmodelBob = useSettingsStore((s) => s.setViewmodelBob);
  const fovScaling = useSettingsStore((s) => s.fovScaling);
  const setFovScaling = useSettingsStore((s) => s.setFovScaling);
  const rtsPanSpeed = useSettingsStore((s) => s.rtsPanSpeed);
  const setRtsPanSpeed = useSettingsStore((s) => s.setRtsPanSpeed);
  const rtsZoomSpeed = useSettingsStore((s) => s.rtsZoomSpeed);
  const setRtsZoomSpeed = useSettingsStore((s) => s.setRtsZoomSpeed);
  const rtsRotateSpeed = useSettingsStore((s) => s.rtsRotateSpeed);
  const setRtsRotateSpeed = useSettingsStore((s) => s.setRtsRotateSpeed);
  const rtsEdgeScrollEnabled = useSettingsStore((s) => s.rtsEdgeScrollEnabled);
  const setRtsEdgeScrollEnabled = useSettingsStore((s) => s.setRtsEdgeScrollEnabled);

  return (
    <div className="space-y-4">
      <SectionTitle>Camera</SectionTitle>
      <ToggleSetting label="Head Bob" value={headBob} onChange={setHeadBob} />
      <SliderSetting label="Smoothing" value={cameraSmoothing} min={0} max={1} step={0.05} onChange={setCameraSmoothing} displayValue={cameraSmoothing === 0 ? 'Off' : `${Math.round(cameraSmoothing * 100)}%`} />
      <ToggleSetting label="FOV Scaling" value={fovScaling} onChange={setFovScaling} />

      <div className="pt-4">
        <SubSectionTitle>Viewmodel</SubSectionTitle>
      </div>
      <ToggleSetting label="Show Weapon" value={viewmodelVisible} onChange={setViewmodelVisible} />
      <SliderSetting label="Weapon Bob" value={viewmodelBob} min={0} max={2} step={0.1} onChange={setViewmodelBob} displayValue={`${Math.round(viewmodelBob * 100)}%`} />

      <div className="pt-4">
        <SubSectionTitle>Editor Camera</SubSectionTitle>
      </div>
      <SliderSetting label="Pan Speed" value={rtsPanSpeed} min={10} max={100} step={5} onChange={setRtsPanSpeed} displayValue={`${rtsPanSpeed}`} />
      <SliderSetting label="Zoom Speed" value={rtsZoomSpeed} min={0.01} max={0.5} step={0.01} onChange={setRtsZoomSpeed} displayValue={rtsZoomSpeed.toFixed(2)} />
      <SliderSetting label="Rotate Speed" value={rtsRotateSpeed} min={0.5} max={5} step={0.5} onChange={setRtsRotateSpeed} displayValue={rtsRotateSpeed.toFixed(1)} />
      <ToggleSetting label="Edge Scrolling" value={rtsEdgeScrollEnabled} onChange={setRtsEdgeScrollEnabled} />
    </div>
  );
}
