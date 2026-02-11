/**
 * Configurable crosshair renderer (dot, cross, ring, scope variants).
 *
 * Depends on: —
 * Used by: game HUD composition, settingsStore (crosshair config)
 */
export type CrosshairType = 'dot' | 'cross' | 'ring' | 'scope';

export interface CrosshairConfig {
  type: CrosshairType;
  size: number;
  color: string;
}

export interface CrosshairProps {
  config: CrosshairConfig;
  /** Show scope overlay instead of small crosshair (e.g. when zoomed) */
  showScope?: boolean;
  /** Opacity override (0–1). Used for ADS fade. */
  opacity?: number;
  /** Bloom/spread expansion in pixels. Arms spread outward by this amount. */
  bloom?: number;
}

export function Crosshair({ config, showScope, opacity = 1, bloom = 0 }: CrosshairProps) {
  const { type, size, color } = config;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={opacity < 1 ? { opacity } : undefined}
    >
      {type === 'dot' && <DotCrosshair size={size} color={color} />}
      {type === 'cross' && <CrossCrosshair size={size} color={color} bloom={bloom} />}
      {type === 'ring' && <RingCrosshair size={size} color={color} bloom={bloom} />}
      {type === 'scope' && (showScope
        ? <ScopeCrosshair size={size * 3} color={color} />
        : <CrossCrosshair size={size / 3} color={color} bloom={bloom} />
      )}
    </div>
  );
}

function DotCrosshair({ size, color }: { size: number; color: string }) {
  return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: '50%' }} />;
}

function CrossCrosshair({ size, color, bloom = 0 }: { size: number; color: string; bloom?: number }) {
  const gap = 3 + bloom;
  const thickness = 2;
  const totalSize = size + bloom * 2;
  const arm = (totalSize - gap) / 2;
  const center = totalSize / 2;
  return (
    <div className="relative" style={{ width: totalSize, height: totalSize }}>
      <div className="absolute" style={{ left: center - 1, top: center - 1, width: 2, height: 2, backgroundColor: color }} />
      <div className="absolute" style={{ left: center - thickness / 2, top: 0, width: thickness, height: arm, backgroundColor: color }} />
      <div className="absolute" style={{ left: center - thickness / 2, bottom: 0, width: thickness, height: arm, backgroundColor: color }} />
      <div className="absolute" style={{ top: center - thickness / 2, left: 0, width: arm, height: thickness, backgroundColor: color }} />
      <div className="absolute" style={{ top: center - thickness / 2, right: 0, width: arm, height: thickness, backgroundColor: color }} />
    </div>
  );
}

function RingCrosshair({ size, color, bloom = 0 }: { size: number; color: string; bloom?: number }) {
  const totalSize = size + bloom * 2;
  return (
    <div
      style={{
        width: totalSize, height: totalSize,
        border: `2px solid ${color}`,
        borderRadius: '50%',
      }}
    >
      <div
        className="absolute"
        style={{
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 2, height: 2,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function ScopeCrosshair({ size, color }: { size: number; color: string }) {
  const thickness = 1;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0"
        style={{ border: `1px solid ${color}`, borderRadius: '50%' }}
      />
      <div
        className="absolute"
        style={{ top: size / 2 - thickness / 2, left: 0, right: 0, height: thickness, backgroundColor: color }}
      />
      <div
        className="absolute"
        style={{ left: size / 2 - thickness / 2, top: 0, bottom: 0, width: thickness, backgroundColor: color }}
      />
      <div
        className="absolute"
        style={{
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 3, height: 3,
          backgroundColor: color,
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
