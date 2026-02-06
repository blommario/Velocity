import { useEffect, useState } from 'react';
import { useGameStore, SCREENS } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { getPlayerProfile } from '../../services/raceService';
import type { PlayerProfileDetailResponse, PlayerRecentRunResponse } from '../../services/types';

const STAT_LABELS = {
  totalRuns: 'Total Runs',
  mapsCreated: 'Maps Created',
  leaderboardEntries: 'Leaderboard Entries',
} as const;

export function PlayerProfile() {
  const playerId = useAuthStore((s) => s.playerId);
  const username = useAuthStore((s) => s.username);
  const [profileData, setProfileData] = useState<PlayerProfileDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    getPlayerProfile(playerId)
      .then(setProfileData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [playerId]);

  const handleBack = () => {
    useGameStore.getState().setScreen(SCREENS.MAIN_MENU);
  };

  return (
    <div className="w-screen h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-8 py-4 border-b border-gray-800">
        <button
          onClick={handleBack}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold tracking-wider">PLAYER PROFILE</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="text-gray-500 text-center py-12">Loading profile...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-12">{error}</div>
        ) : profileData ? (
          <ProfileContent profile={profileData} />
        ) : (
          <FallbackProfile username={username} />
        )}
      </div>
    </div>
  );
}

function ProfileContent({ profile }: { profile: PlayerProfileDetailResponse }) {
  const { profile: p, recentRuns } = profile;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Player Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-2xl font-bold">
            {p.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{p.username}</h2>
            <p className="text-sm text-gray-400">
              {p.isGuest ? 'Guest' : 'Registered'} &middot; Joined {formatDate(p.createdAt)}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <StatCard label={STAT_LABELS.totalRuns} value={p.totalRuns} />
          <StatCard label={STAT_LABELS.mapsCreated} value={p.mapsCreated} />
          <StatCard label={STAT_LABELS.leaderboardEntries} value={p.leaderboardEntries} />
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
          Recent Runs
        </h3>
        {recentRuns.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No runs yet</p>
        ) : (
          <RecentRunsTable runs={recentRuns} />
        )}
      </div>
    </div>
  );
}

function FallbackProfile({ username }: { username: string | null }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          {username?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <h2 className="text-xl font-bold">{username ?? 'Unknown'}</h2>
        <p className="text-sm text-gray-400 mt-2">Profile data unavailable</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function RecentRunsTable({ runs }: { runs: PlayerRecentRunResponse[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-500 text-xs uppercase">
          <th className="text-left pb-2">Map</th>
          <th className="text-right pb-2">Time</th>
          <th className="text-right pb-2">Max Speed</th>
          <th className="text-right pb-2">Date</th>
          <th className="text-right pb-2">PB</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.runId} className="border-t border-gray-800">
            <td className="py-2 font-medium">{run.mapName}</td>
            <td className="py-2 text-right font-mono">{formatTime(run.time)}</td>
            <td className="py-2 text-right font-mono text-gray-400">
              {Math.round(run.maxSpeed)} u/s
            </td>
            <td className="py-2 text-right text-gray-500">{formatDate(run.completedAt)}</td>
            <td className="py-2 text-right">
              {run.isPersonalBest && (
                <span className="text-yellow-400 font-bold text-xs">PB</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
