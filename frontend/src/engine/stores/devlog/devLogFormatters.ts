/**
 * Formatting utilities for DevLogPanel — timestamps, FPS/frametime colors,
 * count formatting, and log entry serialization for clipboard.
 *
 * Depends on: devLogStore types, LEVEL_CONFIG
 * Used by: DevLogPanel, PerfBar, LogRow
 */
import type { LogEntry } from '../devLogStore';
import { LEVEL_CONFIG } from './devLogStyles';

export function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(2, '0')}`;
}

export function getFpsColor(fps: number): string {
  if (fps >= 55) return '#4ade80';
  if (fps >= 30) return '#facc15';
  return '#f87171';
}

export function getFrametimeColor(ft: number): string {
  if (ft <= 18) return '#4ade80';
  if (ft <= 33) return '#facc15';
  return '#f87171';
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatEntryForCopy(entry: LogEntry): string {
  const ts = formatTimestamp(entry.timestamp);
  const lvl = LEVEL_CONFIG[entry.level].label;
  const count = entry.count > 1 ? ` (x${entry.count})` : '';
  return `[${ts}] ${lvl} [${entry.source}] ${entry.message}${count}`;
}
