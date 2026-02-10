import { useEffect } from 'react';
import { GameCanvas } from '@game/components/game/GameCanvas';
import { MainMenu } from '@game/components/menu/MainMenu';
import { AuthScreen } from '@game/components/menu/AuthScreen';
import { MapEditor } from '@game/components/editor/MapEditor';
import { SettingsScreen } from '@game/components/menu/SettingsScreen';
import { RaceLobby } from '@game/components/menu/RaceLobby';
import { PlayerProfile } from '@game/components/menu/PlayerProfile';
import { LoadingScreen } from '@game/components/menu/LoadingScreen';
import { useGameStore, SCREENS } from '@game/stores/gameStore';
import { useAuthStore } from '@game/stores/authStore';

function App() {
  const screen = useGameStore((s) => s.screen);
  const token = useAuthStore((s) => s.token);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  // Restore session from localStorage on mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Not authenticated — show auth screen
  if (!token) {
    return <AuthScreen />;
  }

  // Screen routing
  switch (screen) {
    case SCREENS.MAIN_MENU:
      return <MainMenu />;
    case SCREENS.MAP_EDITOR:
      return <MapEditor />;
    case SCREENS.SETTINGS:
      return <SettingsScreen />;
    case SCREENS.RACE_LOBBY:
      return <RaceLobby />;
    case SCREENS.PROFILE:
      return <PlayerProfile />;
    case SCREENS.LOADING:
    case SCREENS.PLAYING:
      return (
        <>
          <GameCanvas />
          {screen === SCREENS.LOADING && <LoadingScreen />}
        </>
      );
    default:
      return <GameCanvas />;
  }
}

export default App;
