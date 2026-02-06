import { useCombatStore } from '../../stores/combatStore';

const ROCKET_COLOR = '#ff4400';
const GRENADE_COLOR = '#44ff00';

export function ProjectileRenderer() {
  const projectiles = useCombatStore((s) => s.projectiles);

  return (
    <group>
      {projectiles.map((p) => (
        <mesh key={p.id} position={p.position}>
          {p.type === 'rocket' ? (
            <>
              <sphereGeometry args={[0.15, 6, 6]} />
              <meshStandardMaterial
                color={ROCKET_COLOR}
                emissive={ROCKET_COLOR}
                emissiveIntensity={2}
              />
            </>
          ) : (
            <>
              <sphereGeometry args={[0.12, 6, 6]} />
              <meshStandardMaterial
                color={GRENADE_COLOR}
                emissive={GRENADE_COLOR}
                emissiveIntensity={1.5}
              />
            </>
          )}
        </mesh>
      ))}
    </group>
  );
}
