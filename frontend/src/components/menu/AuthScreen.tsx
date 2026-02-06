import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

type AuthMode = 'login' | 'register';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, guestLogin, isLoading, error } = useAuthStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      login({ username, password });
    } else {
      register({ username, password });
    }
  };

  return (
    <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold text-white text-center mb-2 tracking-wider">VELOCITY</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">First-person speedrunning</p>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
              minLength={3}
              maxLength={50}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
              minLength={6}
            />
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-2 rounded transition-colors"
          >
            {isLoading ? '...' : mode === 'login' ? 'Login' : 'Register'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={guestLogin}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Play as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
