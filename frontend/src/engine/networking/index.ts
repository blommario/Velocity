/**
 * Networking barrel — binary position codec and WebSocket transport.
 *
 * Depends on: PositionCodec, GameTransport
 * Used by: multiplayer game layer
 */
export {
  encodePosition,
  decodeBatch,
  MSG_TYPE,
  type PositionSnapshot,
  type DecodedBatch,
} from './PositionCodec';

export {
  WebSocketTransport,
  buildWsUrl,
  type IGameTransport,
  type TransportState,
} from './GameTransport';

export {
  NetworkInterpolator,
  type NetSnapshot,
} from './NetworkInterpolator';

export {
  pushRemoteSnapshot,
  getInterpolator,
  removeInterpolator,
  clearInterpolators,
  getTrackedPlayerIds,
} from './RemotePlayerInterpolators';
