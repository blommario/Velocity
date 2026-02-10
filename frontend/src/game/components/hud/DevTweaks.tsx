import { useMemo, useCallback } from 'react';
import { DevTweaks as EngineDevTweaks, type DevSlider } from '@engine/hud';
import { useSettingsStore } from '@game/stores/settingsStore';
import { PHYSICS } from '../game/physics/constants';

const BASE_SPEED = PHYSICS.GROUND_MAX_SPEED;
const BASE_GRAVITY = PHYSICS.GRAVITY;

export function DevTweaks() {
  const speedMult = useSettingsStore((s) => s.devSpeedMultiplier);
  const gravMult = useSettingsStore((s) => s.devGravityMultiplier);

  const sliders: DevSlider[] = useMemo(() => [
    {
      label: 'Max Speed',
      value: speedMult,
      min: 0.1, max: 1.9, step: 0.05,
      displayValue: `${Math.round(BASE_SPEED * speedMult)} u/s`,
      accentColor: '#22d3ee',
      onChange: (v: number) => useSettingsStore.getState().setDevSpeedMultiplier(v),
    },
    {
      label: 'Gravity',
      value: gravMult,
      min: 0.1, max: 1.9, step: 0.05,
      displayValue: `${Math.round(BASE_GRAVITY * gravMult)} u/s²`,
      accentColor: '#fb923c',
      onChange: (v: number) => useSettingsStore.getState().setDevGravityMultiplier(v),
    },
  ], [speedMult, gravMult]);

  const handleReset = useCallback(() => {
    useSettingsStore.getState().setDevSpeedMultiplier(1.0);
    useSettingsStore.getState().setDevGravityMultiplier(1.0);
  }, []);

  return <EngineDevTweaks sliders={sliders} onReset={handleReset} />;
}
