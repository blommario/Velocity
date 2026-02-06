import { useCombatStore } from '../../stores/combatStore';
import { PHYSICS } from '../game/physics/constants';

const HEALTH_COLORS = {
  HIGH: '#22c55e',
  MEDIUM: '#eab308',
  LOW: '#ef4444',
} as const;

function getHealthColor(health: number): string {
  if (health > 60) return HEALTH_COLORS.HIGH;
  if (health > 30) return HEALTH_COLORS.MEDIUM;
  return HEALTH_COLORS.LOW;
}

export function CombatHud() {
  const health = useCombatStore((s) => s.health);
  const rocketAmmo = useCombatStore((s) => s.rocketAmmo);
  const grenadeAmmo = useCombatStore((s) => s.grenadeAmmo);
  const activeWeapon = useCombatStore((s) => s.activeWeapon);
  const maxRockets = useCombatStore((s) => s.maxRocketAmmo);
  const maxGrenades = useCombatStore((s) => s.maxGrenadeAmmo);

  const healthFraction = health / PHYSICS.HEALTH_MAX;
  const healthColor = getHealthColor(health);

  return (
    <div className="absolute bottom-8 left-8 space-y-2">
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

      {/* Ammo */}
      <div className="flex gap-4 font-mono text-sm">
        <div className={activeWeapon === 'rocket' ? 'text-red-400' : 'text-gray-500'}>
          R: {rocketAmmo}/{maxRockets}
        </div>
        <div className={activeWeapon === 'grenade' ? 'text-green-400' : 'text-gray-500'}>
          G: {grenadeAmmo}/{maxGrenades}
        </div>
      </div>
    </div>
  );
}
