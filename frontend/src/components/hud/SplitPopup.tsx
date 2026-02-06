import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';

const SPLIT_POPUP = {
  DISPLAY_MS: 2000,
  FADE_MS: 500,
} as const;

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatDelta(deltaMs: number): string {
  const sign = deltaMs <= 0 ? '-' : '+';
  return `${sign}${formatTime(Math.abs(deltaMs))}`;
}

export function SplitPopup() {
  const popup = useGameStore((s) => s.activeSplitPopup);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!popup) {
      setVisible(false);
      setFading(false);
      return;
    }

    setVisible(true);
    setFading(false);

    const fadeTimer = setTimeout(() => setFading(true), SPLIT_POPUP.DISPLAY_MS - SPLIT_POPUP.FADE_MS);
    const hideTimer = setTimeout(() => setVisible(false), SPLIT_POPUP.DISPLAY_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [popup?.timestamp]);

  if (!visible || !popup) return null;

  const isAhead = popup.delta !== null && popup.delta <= 0;
  const isBehind = popup.delta !== null && popup.delta > 0;

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 text-center font-mono transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div className="text-sm text-white/60">CP {popup.checkpointIndex + 1}</div>
      <div className="text-lg font-bold tabular-nums text-white">
        {formatTime(popup.time)}
      </div>
      {popup.delta !== null && (
        <div
          className="text-sm font-bold tabular-nums"
          style={{ color: isAhead ? '#22c55e' : isBehind ? '#ef4444' : '#ffffff' }}
        >
          {formatDelta(popup.delta)}
        </div>
      )}
    </div>
  );
}
