import { useGameStore } from '../../stores/gameStore';

export function SpeedMeter() {
  const speed = useGameStore((s) => s.speed);
  const fraction = Math.min(speed / 1000, 1);

  const color =
    speed < 200 ? '#ffffff' :
    speed < 400 ? '#ffd700' :
    speed < 600 ? '#ff8c00' :
    '#ff2020';

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
