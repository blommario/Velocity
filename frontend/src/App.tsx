import { useEffect } from 'react';
import { GameCanvas } from './components/game/GameCanvas';
import { MainMenu } from './components/menu/MainMenu';
import { AuthScreen } from './components/menu/AuthScreen';
import { MapEditor } from './components/editor/MapEditor';
import { SettingsScreen } from './components/menu/SettingsScreen';
import { RaceLobby } from './components/menu/RaceLobby';
import { PlayerProfile } from './components/menu/PlayerProfile';
import { useGameStore, SCREENS } from './stores/gameStore';
import { useAuthStore } from './stores/authStore';

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
    case SCREENS.PLAYING:
      return <GameCanvas />;
    default:
      return <GameCanvas />;
  }
}

export default App;
