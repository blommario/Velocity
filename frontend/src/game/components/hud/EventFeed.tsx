import { useEffect, useRef } from 'react';
import { EventFeed as EngineEventFeed, pushFeedEvent } from '@engine/hud';
import { useGameStore } from '@game/stores/gameStore';
import { useCombatStore } from '@game/stores/combatStore';

export { pushFeedEvent };

export function EventFeed() {
  const currentCheckpoint = useGameStore((s) => s.currentCheckpoint);
  const runState = useGameStore((s) => s.runState);
  const health = useCombatStore((s) => s.health);

  const lastCheckpointRef = useRef(-1);
  const lastRunStateRef = useRef('ready');
  const lastHealthRef = useRef(100);

  // Detect checkpoint hits
  useEffect(() => {
    if (currentCheckpoint > lastCheckpointRef.current && lastCheckpointRef.current >= 0) {
      pushFeedEvent(`Checkpoint ${currentCheckpoint}`, '#ffd700', 'flag');
    }
    lastCheckpointRef.current = currentCheckpoint;
  }, [currentCheckpoint]);

  // Detect run state changes
  useEffect(() => {
    if (runState === 'running' && lastRunStateRef.current !== 'running') {
      pushFeedEvent('Run started!', '#22c55e', 'play');
    }
    if (runState === 'finished' && lastRunStateRef.current !== 'finished') {
      pushFeedEvent('Run complete!', '#60a5fa', 'trophy');
    }
    lastRunStateRef.current = runState;
  }, [runState]);

  // Detect self-damage
  useEffect(() => {
    if (health < lastHealthRef.current) {
      const dmg = Math.round(lastHealthRef.current - health);
      if (dmg > 10) {
        pushFeedEvent(`-${dmg} HP`, '#ef4444', 'heart');
      }
    }
    lastHealthRef.current = health;
  }, [health]);

  return <EngineEventFeed />;
}
