/**
 * Renders networked player models for remote players during a multiplayer match.
 * Loads animated player FBX once, then delegates interpolation and animation
 * to engine NetworkedPlayer. Falls back to capsule while loading.
 *
 * Loads the FBX directly (not via assetManager) so NetworkedPlayer receives
 * the original scene graph — required for SkeletonUtils.clone() to correctly
 * rebind SkinnedMesh skeletons per player instance.
 *
 * Depends on: multiplayerStore, engine NetworkedPlayer, FBXLoader
 * Used by: GameCanvas
 */
import { useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, AnimationClip } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { NetworkedPlayer } from '@engine/rendering/NetworkedPlayer';
import { NetworkedCapsule } from '@engine/rendering/NetworkedCapsule';
import { clearInterpolators, pushRemoteSnapshot } from '@engine/networking/RemotePlayerInterpolators';
import { pollInboundPositions } from '@engine/networking/pollInboundPositions';
import { useMultiplayerStore, slotToPlayer, MULTIPLAYER_STATUS } from '@game/stores/multiplayerStore';
import { PHYSICS } from './physics/constants';
import { devLog } from '@engine/stores/devLogStore';

const REMOTE_COLORS = [
  '#4488ff', '#ff4466', '#44ff88', '#ffaa44',
  '#bb44ff', '#44ffee', '#ff8844', '#88ff44',
] as const;

/** Animated Human FBX is ~525.94 units tall; scale to PLAYER_HEIGHT. */
const MODEL_HEIGHT = 525.94;
const MODEL_SCALE = PHYSICS.PLAYER_HEIGHT / MODEL_HEIGHT;

/** Network sends body center; model origin is at feet → shift down half height. */
const MODEL_Y_OFFSET = -PHYSICS.PLAYER_HEIGHT / 2;

/** FBX model faces +X by default; rotate -90° so it faces the yaw direction. */
const MODEL_YAW_OFFSET = 0;

const PLAYER_MODEL_URL = '/assets/models/player_animated.fbx';

interface PlayerModelAsset {
  /** Original (un-cloned) scene — NetworkedPlayer clones per instance via SkeletonUtils. */
  scene: Group;
  animations: AnimationClip[];
}

let _cachedAsset: PlayerModelAsset | null = null;
let _loadPromise: Promise<PlayerModelAsset> | null = null;
let _fbxLoader: FBXLoader | null = null;

function loadPlayerModel(): Promise<PlayerModelAsset> {
  if (_cachedAsset) return Promise.resolve(_cachedAsset);
  if (_loadPromise) return _loadPromise;

  if (!_fbxLoader) _fbxLoader = new FBXLoader();

  _loadPromise = new Promise<PlayerModelAsset>((resolve, reject) => {
    _fbxLoader!.load(
      PLAYER_MODEL_URL,
      (group) => {
        const asset: PlayerModelAsset = {
          scene: group,
          animations: group.animations ?? [],
        };
        _cachedAsset = asset;
        devLog.success('Net', `Player model loaded (${asset.animations.length} animations)`);
        resolve(asset);
      },
      undefined,
      (err) => {
        devLog.error('Net', `Failed to load player model: ${err}`);
        _loadPromise = null;
        reject(err);
      },
    );
  });

  return _loadPromise;
}

/** Reusable map: slot → playerId (rebuilt from slotToPlayer each frame to avoid alloc). */
const _slotToId = new Map<number, string>();

/** Reusable snapshot object for pushing to interpolators — zero alloc. */
const _snap = { position: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, serverTime: 0 };

/** Throttle counters for devLog in the render loop. */
let _pollLogTimer = 0;
const POLL_LOG_INTERVAL = 2; // seconds between position debug logs
let _lastSnapshotCount = 0;

export function RemotePlayers() {
  const remotePlayerIds = useMultiplayerStore((s) => s.remotePlayerIds);
  const multiplayerStatus = useMultiplayerStore((s) => s.multiplayerStatus);
  const [playerAsset, setPlayerAsset] = useState<PlayerModelAsset | null>(null);

  useEffect(() => {
    loadPlayerModel().then(setPlayerAsset).catch(() => {});
    return () => { clearInterpolators(); };
  }, []);

  // Poll inbound SharedArrayBuffer for remote player positions at 60Hz
  useFrame((_state, delta) => {
    const transport = useMultiplayerStore.getState().getTransport();
    if (!transport) return;
    const sab = transport.getInboundBuffer();
    if (!sab) return;

    // Build slot→playerId map from the richer slotToPlayer map
    _slotToId.clear();
    slotToPlayer.forEach((info, slot) => { _slotToId.set(slot, info.playerId); });

    let snapshotCount = 0;
    pollInboundPositions(sab, _slotToId, (playerId, snap) => {
      _snap.position[0] = snap.posX;
      _snap.position[1] = snap.posY;
      _snap.position[2] = snap.posZ;
      _snap.yaw = snap.yaw;
      _snap.pitch = snap.pitch;
      _snap.serverTime = snap.timestamp;
      pushRemoteSnapshot(playerId, _snap);
      snapshotCount++;
    });

    // Throttled debug logging
    _pollLogTimer += delta;
    if (_pollLogTimer >= POLL_LOG_INTERVAL) {
      _pollLogTimer = 0;
      const slots = Array.from(_slotToId.entries()).map(([s, id]) => `${s}→${id?.slice(0, 8)}`).join(', ');
      devLog.info('Net', `poll: slotMap=[${slots}] snaps=${_lastSnapshotCount}/frame remoteIds=${remotePlayerIds.size}`);
      _lastSnapshotCount = 0;
    }
    _lastSnapshotCount += snapshotCount;
  });

  if (multiplayerStatus !== MULTIPLAYER_STATUS.INGAME && multiplayerStatus !== MULTIPLAYER_STATUS.COUNTDOWN) return null;

  const players: { id: string; slot: number }[] = [];
  slotToPlayer.forEach((info, slot) => {
    if (!info.playerId) return;
    if (!remotePlayerIds.has(info.playerId)) return;
    players.push({ id: info.playerId, slot });
  });

  return (
    <group>
      {players.map((p) =>
        playerAsset ? (
          <NetworkedPlayer
            key={p.id}
            playerId={p.id}
            model={playerAsset.scene}
            animations={playerAsset.animations}
            modelScale={MODEL_SCALE}
            yOffset={MODEL_Y_OFFSET}
            modelYawOffset={MODEL_YAW_OFFSET}
            color={REMOTE_COLORS[p.slot % REMOTE_COLORS.length]}
          />
        ) : (
          <NetworkedCapsule
            key={p.id}
            playerId={p.id}
            radius={PHYSICS.PLAYER_RADIUS}
            height={PHYSICS.PLAYER_HEIGHT}
            color={REMOTE_COLORS[p.slot % REMOTE_COLORS.length]}
          />
        ),
      )}
    </group>
  );
}
