import { useEffect } from 'react';
import { useRaceStore } from '@game/stores/raceStore';
import { useGameStore, SCREENS } from '@game/stores/gameStore';
import { RoomBrowser } from './race/RoomBrowser';
import { RoomLobby } from './race/RoomLobby';
import { CountdownOverlay } from './race/CountdownOverlay';

export function RaceLobby() {
  const currentRoom = useRaceStore((s) => s.currentRoom);
  const countdown = useRaceStore((s) => s.countdown);
  const disconnectFromRace = useRaceStore((s) => s.disconnectFromRace);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      disconnectFromRace();
    };
  }, [disconnectFromRace]);

  const handleBack = () => {
    disconnectFromRace();
    useGameStore.getState().setScreen(SCREENS.MAIN_MENU);
  };

  return (
    <div className="w-screen h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold tracking-wider">LIVE RACE</h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {currentRoom ? <RoomLobby /> : <RoomBrowser />}
      </div>

      {/* Countdown overlay */}
      {countdown !== null && <CountdownOverlay countdown={countdown} />}
    </div>
  );
}
