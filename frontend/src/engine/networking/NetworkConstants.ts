/**
 * Transport configuration constants for multiplayer networking.
 * Shared between WebTransportTransport, transport.worker, and SharedPositionBuffer.
 *
 * Depends on: nothing
 * Used by: WebTransportTransport, transport.worker, SharedPositionBuffer, pollInboundPositions
 */

/** SharedArrayBuffer and worker configuration. */
export const TRANSPORT_CONFIG = {
  /** Outbound SAB total size: 4B generation + 20B position data. */
  OUTBOUND_BUFFER_SIZE: 24,
  /** Inbound SAB header: 4B generation + 4B player count. */
  INBOUND_HEADER_SIZE: 8,
  /** Bytes per remote player slot in inbound SAB. */
  INBOUND_PLAYER_SIZE: 28,
  /** Max remote players supported. */
  MAX_REMOTE_PLAYERS: 32,
  /** Total inbound SAB size: header + 32 * 28. */
  INBOUND_BUFFER_SIZE: 904,
  /** Worker polls outbound SAB at this rate (ms) — 20Hz. */
  WORKER_SEND_INTERVAL_MS: 50,
  /** Reconnect exponential backoff base delay (ms). */
  RECONNECT_BASE_DELAY_MS: 1000,
  /** Reconnect max delay (ms). */
  RECONNECT_MAX_DELAY_MS: 16000,
  /** Max reconnect attempts before giving up. */
  RECONNECT_MAX_ATTEMPTS: 10,
  /** Ping interval for latency measurement (ms). */
  PING_INTERVAL_MS: 5000,
} as const;

/** Type byte written as the first byte on each QUIC bidirectional stream for identification. */
export const STREAM_TYPE = {
  POSITION: 0x01,
  CONTROL: 0x02,
} as const;
