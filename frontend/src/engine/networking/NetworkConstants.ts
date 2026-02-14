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
  /** Bytes per remote player slot in inbound SAB. */
  INBOUND_PLAYER_SIZE: 28,
  /** Max remote players supported. */
  MAX_REMOTE_PLAYERS: 32,
  /** Ring buffer: number of batch slots. Must be power of 2 for fast modulo. */
  INBOUND_RING_SLOTS: 8,
  /** Ring buffer header: 4B writeIndex (atomic). */
  INBOUND_RING_HEADER: 4,
  /** Per-slot header: 4B count (Uint32). */
  INBOUND_SLOT_HEADER: 4,
  /** Per-slot size: slotHeader + MAX_REMOTE_PLAYERS * PLAYER_SIZE = 4 + 32*28 = 900. */
  INBOUND_SLOT_SIZE: 900,
  /** Total inbound SAB: ringHeader + RING_SLOTS * SLOT_SIZE = 4 + 8*900 = 7204. */
  INBOUND_BUFFER_SIZE: 7204,
  /** Worker polls outbound SAB at this rate (ms) — 100Hz. */
  WORKER_SEND_INTERVAL_MS: 10,
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
