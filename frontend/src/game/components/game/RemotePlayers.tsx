/**
 * Renders networked player models for remote players during a multiplayer race.
 * Loads Player.obj once, then delegates interpolation to engine NetworkedPlayer.
 * Falls back to capsule while model is loading.
 *
 * Depends on: raceStore, authStore, engine NetworkedPlayer, OBJLoader
 * Used by: GameCanvas
 */
import { useState, useEffect } from 'react';
import { Group } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { NetworkedPlayer } from '@engine/rendering/NetworkedPlayer';
import { NetworkedCapsule } from '@engine/rendering/NetworkedCapsule';
import { useRaceStore } from '@game/stores/raceStore';
import { useAuthStore } from '@game/stores/authStore';
import { PHYSICS } from './physics/constants';
import { devLog } from '@engine/stores/devLogStore';
import type { NetSnapshot } from '@engine/networking';

const REMOTE_COLORS = [
  '#ff4466', '#44bbff', '#44ff88', '#ffaa44',
  '#bb44ff', '#44ffee', '#ff8844', '#88ff44',
] as const;

/** Player.obj is ~20.74 units tall; scale to PLAYER_HEIGHT. */
const MODEL_HEIGHT = 20.74;
const MODEL_SCALE = PHYSICS.PLAYER_HEIGHT / MODEL_HEIGHT;

/** Network sends body center; model origin is at feet → shift down half height. */
const MODEL_Y_OFFSET = -PHYSICS.PLAYER_HEIGHT / 2;

let _cachedModel: Group | null = null;
let _loadPromise: Promise<Group> | null = null;

function loadPlayerOBJ(): Promise<Group> {
  if (_cachedModel) return Promise.resolve(_cachedModel);
  if (_loadPromise) return _loadPromise;

  const loader = new OBJLoader();
  _loadPromise = new Promise<Group>((resolve, reject) => {
    loader.load(
      '/assets/models/player.obj',
      (group) => {
        _cachedModel = group;
        devLog.success('Net', 'Player model loaded');
        resolve(group);
      },
      undefined,
      (err) => {
        devLog.error('Net', `Failed to load player model: ${err}`);
        reject(err);
      },
    );
  });

  return _loadPromise;
}

export function RemotePlayers() {
  const racePositions = useRaceStore((s) => s.racePositions);
  const raceStatus = useRaceStore((s) => s.raceStatus);
  const localPlayerId = useAuthStore((s) => s.playerId);
  const [playerModel, setPlayerModel] = useState<Group | null>(null);

  useEffect(() => {
    loadPlayerOBJ().then(setPlayerModel).catch(() => {});
  }, []);

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
      {players.map((p) =>
        playerModel ? (
          <NetworkedPlayer
            key={p.id}
            snapshot={p.snapshot}
            model={playerModel}
            modelScale={MODEL_SCALE}
            yOffset={MODEL_Y_OFFSET}
            color={REMOTE_COLORS[p.index % REMOTE_COLORS.length]}
          />
        ) : (
          <NetworkedCapsule
            key={p.id}
            snapshot={p.snapshot}
            radius={PHYSICS.PLAYER_RADIUS}
            height={PHYSICS.PLAYER_HEIGHT}
            color={REMOTE_COLORS[p.index % REMOTE_COLORS.length]}
          />
        ),
      )}
    </>
  );
}
