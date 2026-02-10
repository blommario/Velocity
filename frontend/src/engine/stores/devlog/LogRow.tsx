/**
 * Single log entry row — memoized for performance. Shows timestamp, level
 * icon, source tag, message, and optional repeat count badge.
 *
 * Depends on: devLogStore LogEntry, devLogStyles, devLogFormatters
 * Used by: DevLogPanel
 */
import { memo } from 'react';
import type { LogEntry } from '../devLogStore';
import { styles, LEVEL_CONFIG } from './devLogStyles';
import { formatTimestamp } from './devLogFormatters';

export const LogRow = memo(function LogRow({ entry, onClick }: { entry: LogEntry; onClick: (e: LogEntry) => void }) {
  const cfg = LEVEL_CONFIG[entry.level];
  return (
    <div
      style={styles.row(entry.count > 1 ? cfg.bg : 'transparent')}
      onClick={() => onClick(entry)}
      title="Click to copy"
    >
      <span style={styles.rowTs}>{formatTimestamp(entry.timestamp)}</span>
      <span style={styles.rowIcon(cfg.color)}>{cfg.icon}</span>
      <span style={styles.rowSource}>[{entry.source}]</span>
      <span style={styles.rowMsg(cfg.color)}>{entry.message}</span>
      {entry.count > 1 && (
        <span style={styles.rowCount(cfg.color)}>x{entry.count}</span>
      )}
    </div>
  );
});
