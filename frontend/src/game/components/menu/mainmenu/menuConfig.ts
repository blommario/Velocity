/**
 * Static configuration for the main menu — difficulty color maps, nav items,
 * map icons, and filter options.
 *
 * Depends on: gameStore SCREENS, MapDifficulty type
 * Used by: MainMenu, MapCards
 */
import { SCREENS } from '@game/stores/gameStore';
import type { MapDifficulty } from '@game/services/types';

export const DIFFICULTY_COLORS: Record<MapDifficulty, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-amber-400',
  Hard: 'text-orange-400',
  Expert: 'text-rose-400',
} as const;

export const DIFFICULTY_BADGE: Record<MapDifficulty, string> = {
  Easy: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10',
  Medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10',
  Hard: 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-orange-500/10',
  Expert: 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/10',
} as const;

export const DIFFICULTY_ACCENT: Record<MapDifficulty, string> = {
  Easy: 'from-emerald-400/60 via-emerald-400/20 to-transparent',
  Medium: 'from-amber-400/60 via-amber-400/20 to-transparent',
  Hard: 'from-orange-400/60 via-orange-400/20 to-transparent',
  Expert: 'from-rose-400/60 via-rose-400/20 to-transparent',
} as const;

export const DIFFICULTY_HOVER: Record<MapDifficulty, string> = {
  Easy: 'hover:border-emerald-500/30 hover:shadow-emerald-500/10',
  Medium: 'hover:border-amber-500/30 hover:shadow-amber-500/10',
  Hard: 'hover:border-orange-500/30 hover:shadow-orange-500/10',
  Expert: 'hover:border-rose-500/30 hover:shadow-rose-500/10',
} as const;

export const MAP_ICONS: Record<string, string> = {
  'first-steps': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
} as const;

export const DIFFICULTY_OPTIONS: (MapDifficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard', 'Expert'];

export const NAV_ITEMS = [
  { label: 'QUICK PLAY', icon: 'M5 3l14 9-14 9V3z', screen: null, accent: 'cyan' },
  { label: 'MAP EDITOR', icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', screen: SCREENS.MAP_EDITOR, accent: 'violet' },
  { label: 'LIVE RACE', icon: 'M13 10V3L4 14h7v7l9-11h-7z', screen: SCREENS.RACE_LOBBY, accent: 'blue' },
  { label: 'PROFILE', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', screen: SCREENS.PROFILE, accent: 'gray' },
  { label: 'SETTINGS', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', screen: SCREENS.SETTINGS, accent: 'gray' },
] as const;

export const NAV_ACCENT_STYLES: Record<string, string> = {
  cyan: 'border-cyan-500/40 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:shadow-cyan-500/20 text-cyan-400',
  violet: 'border-violet-500/40 hover:border-violet-400/60 hover:bg-violet-500/10 hover:shadow-violet-500/20 text-violet-400',
  blue: 'border-blue-500/40 hover:border-blue-400/60 hover:bg-blue-500/10 hover:shadow-blue-500/20 text-blue-400',
  gray: 'border-white/10 hover:border-white/20 hover:bg-white/5 hover:shadow-white/5 text-gray-400',
} as const;

export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
