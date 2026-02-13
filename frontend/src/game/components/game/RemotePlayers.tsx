/**
 * Renders networked player models for remote players during a multiplayer match.
 * Loads Player.obj once, then delegates interpolation to engine NetworkedPlayer.
 * Falls back to capsule while model is loading.
 * Uses remotePlayerIds (Set) to drive the component list — position data flows
 * through RemotePlayerInterpolators outside React for zero-churn 60Hz sampling.
 *
 * Depends on: multiplayerStore, engine NetworkedPlayer, OBJLoader
 * Used by: GameCanvas
 */
import { useState, useEffect } from 'react';
import { Group } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { NetworkedPlayer } from '@engine/rendering/NetworkedPlayer';
import { NetworkedCapsule } from '@engine/rendering/NetworkedCapsule';
import { useMultiplayerStore } from '@game/stores/multiplayerStore';
import { PHYSICS } from './physics/constants';
import { devLog } from '@engine/stores/devLogStore';

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
  const remotePlayerIds = useMultiplayerStore((s) => s.remotePlayerIds);
  const multiplayerStatus = useMultiplayerStore((s) => s.multiplayerStatus);
  const [playerModel, setPlayerModel] = useState<Group | null>(null);

  useEffect(() => {
    loadPlayerOBJ().then(setPlayerModel).catch(() => {});
  }, []);

  if (multiplayerStatus !== 'racing' && multiplayerStatus !== 'countdown') return null;

  const players: { id: string; index: number }[] = [];
  let i = 0;
  remotePlayerIds.forEach((id) => {
    players.push({ id, index: i });
    i++;
  });

  return (
    <>
      {players.map((p) =>
        playerModel ? (
          <NetworkedPlayer
            key={p.id}
            playerId={p.id}
            model={playerModel}
            modelScale={MODEL_SCALE}
            yOffset={MODEL_Y_OFFSET}
            color={REMOTE_COLORS[p.index % REMOTE_COLORS.length]}
          />
        ) : (
          <NetworkedCapsule
            key={p.id}
            playerId={p.id}
            radius={PHYSICS.PLAYER_RADIUS}
            height={PHYSICS.PLAYER_HEIGHT}
            color={REMOTE_COLORS[p.index % REMOTE_COLORS.length]}
          />
        ),
      )}
    </>
  );
}
