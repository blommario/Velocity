/**
 * Networking barrel — binary position codec and WebTransport transport.
 *
 * Depends on: PositionCodec, GameTransport, WebTransportTransport
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
  buildTransportUrl,
  type IGameTransport,
  type TransportState,
} from './GameTransport';

export { WebTransportTransport } from './WebTransportTransport';

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

export { pollInboundPositions, resetInboundPoll } from './pollInboundPositions';
