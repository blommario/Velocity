import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';

const STAGES = [
  'Initializing graphics...',
  'Setting up physics...',
  'Loading map...',
  'Compiling shaders...',
  'Ready',
] as const;

export function LoadingScreen() {
  const progress = useGameStore((s) => s.loadProgress);
  const status = useGameStore((s) => s.loadStatus);
  const mapName = useGameStore((s) => s.currentMapData?.name ?? 'Loading');
  const barRef = useRef<HTMLDivElement>(null);
  const [fadeOut, setFadeOut] = useState(false);

  // Smooth the progress bar with CSS transition
  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.width = `${Math.min(progress * 100, 100)}%`;
    }
  }, [progress]);

  // Fade out when progress reaches 100%
  useEffect(() => {
    if (progress >= 1) {
      setFadeOut(true);
    }
  }, [progress]);

  const pct = Math.round(progress * 100);
  const stageIndex = STAGES.findIndex((s) => s === status);
  const stageNum = stageIndex >= 0 ? stageIndex + 1 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0e17]"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* Title */}
      <h1
        className="text-[2rem] tracking-[0.5em] font-light mb-2"
        style={{ color: '#5ee8d0', fontFamily: 'monospace' }}
      >
        VELOCITY
      </h1>

      {/* Map name */}
      <p
        className="text-sm tracking-[0.2em] mb-12 opacity-60"
        style={{ color: '#8af0df', fontFamily: 'monospace' }}
      >
        {mapName.toUpperCase()}
      </p>

      {/* Progress bar container */}
      <div className="w-80 relative">
        {/* Background track */}
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          {/* Fill bar */}
          <div
            ref={barRef}
            className="h-full rounded-full"
            style={{
              width: '0%',
              background: 'linear-gradient(90deg, #00c9a7, #5ee8d0)',
              transition: 'width 0.4s ease-out',
              boxShadow: '0 0 12px rgba(94, 232, 208, 0.5)',
            }}
          />
        </div>

        {/* Status text + percentage */}
        <div className="flex justify-between mt-3">
          <span
            className="text-xs opacity-50"
            style={{ color: '#5ee8d0', fontFamily: 'monospace' }}
          >
            {status || STAGES[0]}
          </span>
          <span
            className="text-xs opacity-50"
            style={{ color: '#5ee8d0', fontFamily: 'monospace' }}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Stage dots */}
      <div className="flex gap-3 mt-8">
        {STAGES.slice(0, -1).map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i < stageNum ? '#5ee8d0' : 'rgba(255,255,255,0.15)',
              boxShadow: i < stageNum ? '0 0 6px rgba(94, 232, 208, 0.6)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
