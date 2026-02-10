import { useState } from 'react';
import { useAuthStore } from '@game/stores/authStore';

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
    <div className="w-screen h-screen bg-[#06060c] flex items-center justify-center relative overflow-hidden">
      {/* Star field */}
      <div className="stars-small" />
      <div className="stars-medium" />
      <div className="stars-large" />

      {/* Nebula clouds */}
      <div
        className="nebula"
        style={{ top: '20%', left: '15%', width: 450, height: 450, background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)' }}
      />
      <div
        className="nebula"
        style={{ bottom: '15%', right: '10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', animationDelay: '10s' }}
      />

      {/* Shooting star */}
      <div className="shooting-star" style={{ top: '18%' }} />

      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-4">
            <div className="absolute -inset-2 bg-cyan-400/25 rounded-2xl blur-xl animate-pulse" />
            <div className="relative w-14 h-14 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/40">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 7l5 5-5 5M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-[0.3em] bg-gradient-to-r from-white via-cyan-100 to-white/60 bg-clip-text text-transparent">
            VELOCITY
          </h1>
          <p className="text-[10px] tracking-[0.5em] text-cyan-500/40 font-mono uppercase mt-1">
            Speedrun Engine
          </p>
        </div>

        {/* Auth form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 space-y-4 backdrop-blur-sm"
        >
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono"
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono"
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-rose-400 text-xs font-mono bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-2.5 rounded-lg transition-all text-sm tracking-wider uppercase shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
          >
            {isLoading ? '...' : mode === 'login' ? 'Login' : 'Register'}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors font-mono"
            >
              {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
          </div>
        </form>

        {/* Guest */}
        <div className="mt-5 text-center">
          <button
            onClick={guestLogin}
            disabled={isLoading}
            className="text-xs text-gray-600 hover:text-cyan-400/80 transition-colors font-mono uppercase tracking-widest border border-white/[0.06] hover:border-cyan-500/30 rounded-lg px-6 py-2"
          >
            Play as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
