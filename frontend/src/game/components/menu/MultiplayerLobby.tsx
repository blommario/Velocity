/**
 * Race lobby container — routes between RoomBrowser, RoomLobby, RaceResults,
 * and overlays (countdown, disconnect).
 *
 * Depends on: raceStore, gameStore
 * Used by: App.tsx (screen router)
 */
import { useEffect } from 'react';
import { useRaceStore } from '@game/stores/raceStore';
import { useGameStore, SCREENS } from '@game/stores/gameStore';
import { RoomBrowser } from './race/RoomBrowser';
import { RoomLobby } from './race/RoomLobby';
import { RaceResults } from './race/RaceResults';
import { CountdownOverlay } from './race/CountdownOverlay';

export function RaceLobby() {
  const currentRoom = useRaceStore((s) => s.currentRoom);
  const countdown = useRaceStore((s) => s.countdown);
  const raceStatus = useRaceStore((s) => s.raceStatus);
  const disconnectedMessage = useRaceStore((s) => s.disconnectedMessage);
  const isReconnecting = useRaceStore((s) => s.isReconnecting);
  const reconnectAttempt = useRaceStore((s) => s.reconnectAttempt);
  const disconnectFromRace = useRaceStore((s) => s.disconnectFromRace);
  const retryReconnect = useRaceStore((s) => s.retryReconnect);

  // Cleanup on unmount — but NOT if race is starting (screen transition to PLAYING)
  useEffect(() => {
    return () => {
      const { raceStatus } = useRaceStore.getState();
      if (raceStatus !== 'racing' && raceStatus !== 'countdown') {
        disconnectFromRace();
      }
    };
  }, [disconnectFromRace]);

  const handleBack = () => {
    disconnectFromRace();
    useGameStore.getState().setScreen(SCREENS.MAIN_MENU);
  };

  const renderContent = () => {
    if (raceStatus === 'finished' && currentRoom) {
      return <RaceResults />;
    }
    if (currentRoom) {
      return <RoomLobby />;
    }
    return <RoomBrowser />;
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
        {renderContent()}
      </div>

      {/* Countdown overlay */}
      {countdown !== null && <CountdownOverlay countdown={countdown} />}

      {/* Reconnecting overlay */}
      {isReconnecting && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-sm text-center space-y-4">
            <div className="inline-block w-8 h-8 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
            <h3 className="text-xl font-bold text-yellow-400">Reconnecting...</h3>
            <p className="text-sm text-gray-300">Attempt {reconnectAttempt} of 10</p>
            <button
              onClick={() => { disconnectFromRace(); }}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Disconnected overlay (reconnect exhausted or server-closed) */}
      {disconnectedMessage && !isReconnecting && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-sm text-center space-y-4">
            <h3 className="text-xl font-bold text-red-400">Disconnected</h3>
            <p className="text-sm text-gray-300">{disconnectedMessage}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={retryReconnect}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => { disconnectFromRace(); }}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
