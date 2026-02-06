import { useGameStore } from '../../stores/gameStore';

const SPEED_METER = {
  MAX_DISPLAY: 1000,
  THRESHOLDS: [
    { min: 600, color: '#ff2020' },
    { min: 400, color: '#ff8c00' },
    { min: 200, color: '#ffd700' },
    { min: 0, color: '#ffffff' },
  ],
} as const;

function getSpeedColor(speed: number): string {
  for (const { min, color } of SPEED_METER.THRESHOLDS) {
    if (speed >= min) return color;
  }
  return SPEED_METER.THRESHOLDS.at(-1)!.color;
}

export function SpeedMeter() {
  const speed = useGameStore((s) => s.speed);
  const fraction = Math.min(speed / SPEED_METER.MAX_DISPLAY, 1);
  const color = getSpeedColor(speed);

  return (
    <div className="absolute bottom-8 left-8 w-64">
      <div className="h-2 bg-gray-800/80 rounded overflow-hidden">
        <div
          className="h-full rounded transition-[width] duration-75"
          style={{ width: `${fraction * 100}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color }}>
        {Math.round(speed)} <span className="text-xs opacity-60">u/s</span>
      </div>
    </div>
  );
}
