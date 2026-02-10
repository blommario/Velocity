/**
 * Renders a movement trail for the ghost replay, visible during active runs.
 * Uses engine SpeedTrail with ghost position from replayStore.
 * Depends on: EngineSpeedTrail, replayStore, gameStore, settingsStore
 * Used by: GameCanvas (3D effects layer)
 */
import { useCallback } from 'react';
import { SpeedTrail as EngineSpeedTrail } from '@engine/effects/SpeedTrail';
import { useReplayStore } from '@game/stores/replayStore';
import { useGameStore, RUN_STATES } from '@game/stores/gameStore';
import { useSettingsStore } from '@game/stores/settingsStore';

const GHOST_TRAIL_CONFIG = {
  speedThreshold: 200,
  maxPoints: 60,
  updateInterval: 0.05,
  baseColor: '#4488ff',
  fastColor: '#88ccff',
  speedForFast: 600,
} as const;

/** Estimated speed from ghost position delta (cached between calls). */
let _prevGhostPos: [number, number, number] = [0, 0, 0];
let _prevGhostTime = 0;
let _ghostSpeed = 0;

export function GhostTrail() {
  const hasGhost = useReplayStore((s) => s.ghostReplay !== null);
  const particles = useSettingsStore((s) => s.particles);

  const getSpeed = useCallback(() => _ghostSpeed, []);

  const getPosition = useCallback((): [number, number, number] => {
    const store = useGameStore.getState();
    const replay = useReplayStore.getState();
    if (store.runState !== RUN_STATES.RUNNING || !replay.ghostReplay) {
      return _prevGhostPos;
    }
    const elapsedMs = performance.now() - store.startTime;
    const ghostData = replay.getGhostPosition(elapsedMs);
    if (!ghostData) return _prevGhostPos;

    // Estimate ghost speed from position delta
    const now = performance.now();
    const dt = (now - _prevGhostTime) / 1000;
    if (dt > 0.01 && _prevGhostTime > 0) {
      const dx = ghostData.position[0] - _prevGhostPos[0];
      const dz = ghostData.position[2] - _prevGhostPos[2];
      _ghostSpeed = Math.sqrt(dx * dx + dz * dz) / dt;
    }
    _prevGhostPos = [ghostData.position[0], ghostData.position[1], ghostData.position[2]];
    _prevGhostTime = now;
    return _prevGhostPos;
  }, []);

  if (!hasGhost) return null;

  return (
    <EngineSpeedTrail
      getSpeed={getSpeed}
      getPosition={getPosition}
      enabled={particles}
      config={GHOST_TRAIL_CONFIG}
    />
  );
}
