import { SpeedMeter } from './SpeedMeter';
import { Timer } from './Timer';
import { Crosshair } from './Crosshair';
import { CheckpointCounter } from './CheckpointCounter';
import { SplitPopup } from './SplitPopup';
import { TrackProgressBar } from './TrackProgressBar';
import { SpeedLines } from './SpeedLines';
import { EndRunModal } from './EndRunModal';
import { useGameStore, RUN_STATES } from '../../stores/gameStore';

export function HudOverlay() {
  const isGrounded = useGameStore((s) => s.isGrounded);
  const position = useGameStore((s) => s.position);
  const runState = useGameStore((s) => s.runState);

  return (
    <div className="absolute inset-0 pointer-events-none text-white">
      <Crosshair />
      <Timer />
      <SpeedMeter />
      <CheckpointCounter />
      <SplitPopup />
      <SpeedLines />
      <TrackProgressBar />

      {runState === RUN_STATES.READY && <ReadyPrompt />}

      {/* Debug info - bottom right */}
      <div className="absolute bottom-8 right-8 font-mono text-xs text-white/40">
        <div>pos: {position.map((v) => v.toFixed(1)).join(', ')}</div>
        <div>grounded: {isGrounded ? 'yes' : 'no'}</div>
      </div>

      <EndRunModal />
    </div>
  );
}

function ReadyPrompt() {
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center">
      <div className="text-lg font-bold text-green-400 animate-pulse">
        Walk through the start zone to begin
      </div>
    </div>
  );
}
