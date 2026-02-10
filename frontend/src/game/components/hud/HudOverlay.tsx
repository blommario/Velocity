/**
 * Root HUD overlay — composes all game HUD elements (crosshair, timer, speed, combat, effects, modals) into a single full-screen pointer-events-none layer.
 * Depends on: All game HUD components, gameStore (runState)
 * Used by: Game scene (rendered on top of the 3D canvas)
 */
import { SpeedMeter } from './SpeedMeter';
import { Timer } from './Timer';
import { Crosshair } from './Crosshair';
import { CheckpointCounter } from './CheckpointCounter';
import { SplitPopup } from './SplitPopup';
import { TrackProgressBar } from './TrackProgressBar';
import { SpeedLines } from './SpeedLines';
import { CombatHud } from './CombatHud';
import { EndRunModal } from './EndRunModal';
import { DevTweaks } from './DevTweaks';
import { ScreenEffects } from './ScreenEffects';
import { DamageIndicator } from './DamageIndicator';
import { DamageNumbers } from './DamageNumbers';
import { EventFeed } from './EventFeed';
import { HitMarker } from './HitMarker';
import { KillFeed } from './KillFeed';
import { ScopeOverlay } from './ScopeOverlay';
import { StanceIndicator } from './StanceIndicator';
import { ReloadIndicator } from './ReloadIndicator';
import { HeadshotStreak } from './HeadshotStreak';
import { CriticalHitFlash } from './CriticalHitFlash';
import { WeaponWheelOverlay } from './WeaponWheelOverlay';
import { KillstreakPopup } from './KillstreakPopup';
import { useGameStore, RUN_STATES } from '@game/stores/gameStore';

export function HudOverlay() {
  const runState = useGameStore((s) => s.runState);

  return (
    <div className="absolute inset-0 pointer-events-none text-white">
      <Crosshair />
      <ReloadIndicator />
      <ScopeOverlay />
      <Timer />
      <SpeedMeter />
      <CheckpointCounter />
      <SplitPopup />
      <SpeedLines />
      <CombatHud />
      <TrackProgressBar />
      <DamageIndicator />
      <DamageNumbers />
      <HitMarker />
      <HeadshotStreak />
      <CriticalHitFlash />
      <EventFeed />
      <KillFeed />
      <StanceIndicator />
      <WeaponWheelOverlay />
      <KillstreakPopup />

      {runState === RUN_STATES.READY && <ReadyPrompt />}

      <DebugPosition />

      <ScreenEffects />
      <DevTweaks />
      <EndRunModal />
    </div>
  );
}

/** Isolated from HudOverlay so 30Hz position updates don't diff the entire HUD tree. */
function DebugPosition() {
  const position = useGameStore((s) => s.position);
  const isGrounded = useGameStore((s) => s.isGrounded);

  return (
    <div className="absolute bottom-8 right-8 font-mono text-xs text-white/40">
      <div>pos: {position.map((v) => v.toFixed(1)).join(', ')}</div>
      <div>grounded: {isGrounded ? 'yes' : 'no'}</div>
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
