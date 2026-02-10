/**
 * Start zone -- begins a speedrun when the player enters while in the READY state.
 * Depends on: SensorZone, gameStore (startRun)
 * Used by: MapLoader, TestMap
 */
import { SensorZone } from '@engine/components';
import { useGameStore, RUN_STATES } from '@game/stores/gameStore';

interface StartZoneProps {
  position: [number, number, number];
  size: [number, number, number];
}

export function StartZone({ position, size }: StartZoneProps) {
  const handleEnter = () => {
    const state = useGameStore.getState();
    if (state.runState === RUN_STATES.READY) {
      state.startRun();
    }
  };

  return <SensorZone position={position} size={size} onEnter={handleEnter} />;
}
