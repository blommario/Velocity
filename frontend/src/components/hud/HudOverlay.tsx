import { SpeedMeter } from './SpeedMeter';
import { Timer } from './Timer';
import { Crosshair } from './Crosshair';
import { useGameStore } from '../../stores/gameStore';

export function HudOverlay() {
  const isGrounded = useGameStore((s) => s.isGrounded);
  const position = useGameStore((s) => s.position);

  return (
    <div className="absolute inset-0 pointer-events-none text-white">
      <Crosshair />
      <Timer />
      <SpeedMeter />

      {/* Debug info - bottom right */}
      <div className="absolute bottom-8 right-8 font-mono text-xs text-white/40">
        <div>pos: {position.map((v) => v.toFixed(1)).join(', ')}</div>
        <div>grounded: {isGrounded ? 'yes' : 'no'}</div>
      </div>

      {/* Click to play prompt */}
      <ClickPrompt />
    </div>
  );
}

function ClickPrompt() {
  return (
    <div
      id="click-prompt"
      className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none"
      style={{ display: 'none' }}
    >
      <div className="text-center">
        <div className="text-2xl font-bold mb-2">VELOCITY</div>
        <div className="text-sm text-white/60">Click to play</div>
      </div>
    </div>
  );
}
