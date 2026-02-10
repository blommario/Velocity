import { SpeedMeter as EngineSpeedMeter } from '../../engine/hud';
import { useGameStore } from '../../stores/gameStore';

export function SpeedMeter() {
  const speed = useGameStore((s) => s.speed);
  return <EngineSpeedMeter speed={speed} />;
}
