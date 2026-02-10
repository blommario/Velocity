/**
 * RTS camera controller — game-level wrapper around engine useRtsCamera.
 *
 * Reads settings from settingsStore and passes them as config.
 * Mount this component when camera mode is 'rts'; unmount for FPS mode.
 */
import { useRtsCamera, type RtsCameraConfig } from './useRtsCamera';
import { useSettingsStore } from '../stores/settingsStore';

export interface RtsCameraControllerProps {
  /** Override any RtsCameraConfig fields */
  config?: Partial<RtsCameraConfig>;
}

export function RtsCameraController({ config }: RtsCameraControllerProps) {
  const panSpeed = useSettingsStore((s) => s.rtsPanSpeed);
  const zoomSpeed = useSettingsStore((s) => s.rtsZoomSpeed);
  const rotateSpeed = useSettingsStore((s) => s.rtsRotateSpeed);
  const edgeScrollEnabled = useSettingsStore((s) => s.rtsEdgeScrollEnabled);

  useRtsCamera({
    panSpeed,
    zoomSpeed,
    rotateSpeed,
    edgeScrollEnabled,
    ...config,
  });

  return null;
}
