export interface WeaponDisplay {
  id: string;
  short: string;
  color: string;
}

export interface AmmoDisplay {
  current: number;
  max: number;
  magazine?: number;
  magSize?: number;
}

export interface CombatHudProps {
  health: number;
  healthMax: number;
  activeWeapon: WeaponDisplay;
  ammo: AmmoDisplay | null;
  isZoomed?: boolean;
  swapCooldown?: number;
  /** Weapon slots bar (ordered) */
  slots?: readonly { weapon: WeaponDisplay; hasAmmo: boolean }[];
  className?: string;
}

const HEALTH_COLORS = {
  HIGH: '#22c55e',
  MEDIUM: '#eab308',
  LOW: '#ef4444',
} as const;

function getHealthColor(health: number, max: number): string {
  const pct = health / max;
  if (pct > 0.6) return HEALTH_COLORS.HIGH;
  if (pct > 0.3) return HEALTH_COLORS.MEDIUM;
  return HEALTH_COLORS.LOW;
}

export function CombatHud({
  health,
  healthMax,
  activeWeapon,
  ammo,
  isZoomed,
  swapCooldown = 0,
  slots,
  className,
}: CombatHudProps) {
  const healthFraction = health / healthMax;
  const healthColor = getHealthColor(health, healthMax);

  return (
    <div className={className ?? 'absolute bottom-8 left-8 space-y-2'}>
      {/* Health bar */}
      <div>
        <div className="h-1.5 w-48 bg-gray-800/80 rounded overflow-hidden">
          <div
            className="h-full rounded transition-[width] duration-100"
            style={{ width: `${healthFraction * 100}%`, backgroundColor: healthColor }}
          />
        </div>
        <div className="font-mono text-xs mt-0.5" style={{ color: healthColor }}>
          {Math.ceil(health)} HP
        </div>
      </div>

      {/* Active weapon + ammo */}
      <div className="flex items-center gap-3">
        <div
          className="font-mono text-sm font-bold px-2 py-0.5 rounded border"
          style={{
            color: activeWeapon.color,
            borderColor: activeWeapon.color + '60',
            opacity: swapCooldown > 0 ? 0.4 : 1,
          }}
        >
          {activeWeapon.short}
        </div>
        {ammo && (
          <div className="font-mono text-sm" style={{ color: activeWeapon.color }}>
            {ammo.magazine !== undefined
              ? `${ammo.magazine}/${ammo.magSize} [${Math.floor(ammo.current)}]`
              : `${Math.floor(ammo.current)}/${ammo.max}`
            }
          </div>
        )}
        {isZoomed && (
          <div className="font-mono text-[10px] text-purple-400 uppercase">ZOOM</div>
        )}
      </div>

      {/* Weapon slots bar */}
      {slots && (
        <div className="flex gap-1">
          {slots.map(({ weapon, hasAmmo }, i) => {
            const isActive = weapon.id === activeWeapon.id;
            return (
              <div
                key={weapon.id}
                className="font-mono text-[9px] px-1 py-0.5 rounded"
                style={{
                  color: isActive ? weapon.color : hasAmmo ? '#666' : '#333',
                  backgroundColor: isActive ? weapon.color + '20' : 'transparent',
                  borderBottom: isActive ? `1px solid ${weapon.color}` : '1px solid transparent',
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
