/**
 * Source filter bar — toggle buttons to filter log entries by source tag.
 *
 * Depends on: devLogStyles
 * Used by: DevLogPanel
 */
import { styles } from './devLogStyles';

export function FilterBar({ sources, activeFilter, onFilter }: {
  sources: string[];
  activeFilter: string | null;
  onFilter: (s: string | null) => void;
}) {
  if (sources.length <= 1) return null;
  return (
    <div style={styles.filterBar}>
      <button style={styles.filterBtn(activeFilter === null)} onClick={() => onFilter(null)}>
        ALL
      </button>
      {sources.map((src) => (
        <button
          key={src}
          style={styles.filterBtn(activeFilter === src)}
          onClick={() => onFilter(activeFilter === src ? null : src)}
        >
          {src}
        </button>
      ))}
    </div>
  );
}
