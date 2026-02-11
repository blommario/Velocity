/**
 * Renders networked capsules for remote players during a multiplayer race.
 * Thin wrapper that reads Velocity stores and delegates to engine NetworkedCapsule.
 *
 * Depends on: raceStore, authStore, engine NetworkedCapsule
 * Used by: GameCanvas
 */
import { NetworkedCapsule } from '@engine/rendering/NetworkedCapsule';
import { useRaceStore } from '@game/stores/raceStore';
import { useAuthStore } from '@game/stores/authStore';
import { PHYSICS } from './physics/constants';
import type { NetSnapshot } from '@engine/networking';

const REMOTE_COLORS = [
  '#ff4466', '#44bbff', '#44ff88', '#ffaa44',
  '#bb44ff', '#44ffee', '#ff8844', '#88ff44',
] as const;

export function RemotePlayers() {
  const racePositions = useRaceStore((s) => s.racePositions);
  const raceStatus = useRaceStore((s) => s.raceStatus);
  const localPlayerId = useAuthStore((s) => s.playerId);

  if (raceStatus !== 'racing' && raceStatus !== 'countdown') return null;

  const players: { id: string; snapshot: NetSnapshot; index: number }[] = [];
  let i = 0;
  racePositions.forEach((pos, id) => {
    if (id !== localPlayerId) {
      players.push({ id, snapshot: pos, index: i });
    }
    i++;
  });

  return (
    <>
      {players.map((p) => (
        <NetworkedCapsule
          key={p.id}
          snapshot={p.snapshot}
          radius={PHYSICS.PLAYER_RADIUS}
          height={PHYSICS.PLAYER_HEIGHT}
          color={REMOTE_COLORS[p.index % REMOTE_COLORS.length]}
        />
      ))}
    </>
  );
}
