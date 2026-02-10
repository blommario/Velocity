/**
 * Game-specific killstreak popup wrapper — reads killstreak/multikill state from combatStore
 * and plays corresponding sounds. Passes data to engine KillstreakPopup component.
 * Depends on: EngineKillstreakPopup, combatStore, audioManager
 * Used by: HudOverlay
 */
import { useRef, useEffect, useMemo } from 'react';
import { KillstreakPopup as EngineKillstreakPopup } from '@engine/hud';
import type { MultikillEvent } from '@engine/hud';
import { useCombatStore } from '@game/stores/combatStore';
import { audioManager, SOUNDS } from '@engine/audio/AudioManager';

export function KillstreakPopup() {
  const killStreak = useCombatStore((s) => s.killStreak);
  const lastKillTime = useCombatStore((s) => s.lastKillTime);
  const multiKillCount = useCombatStore((s) => s.multiKillCount);
  const prevMultiRef = useRef(0);
  const prevStreakRef = useRef(0);

  // Build multikill event only when count changes and is >= 2
  const multiKill = useMemo<MultikillEvent | null>(() => {
    if (multiKillCount >= 2) {
      return { count: multiKillCount, timestamp: lastKillTime };
    }
    return null;
  }, [multiKillCount, lastKillTime]);

  // Play multikill sound when count increases
  useEffect(() => {
    if (multiKillCount >= 2 && multiKillCount > prevMultiRef.current) {
      audioManager.play(SOUNDS.MULTIKILL);
    }
    prevMultiRef.current = multiKillCount;
  }, [multiKillCount]);

  // Play killstreak sound at milestone thresholds
  useEffect(() => {
    const milestones = [5, 10, 15, 20, 25];
    if (killStreak > prevStreakRef.current && milestones.includes(killStreak)) {
      audioManager.play(SOUNDS.KILLSTREAK);
    }
    prevStreakRef.current = killStreak;
  }, [killStreak]);

  return (
    <EngineKillstreakPopup
      killStreak={killStreak}
      lastKillTime={lastKillTime}
      multiKill={multiKill}
    />
  );
}
