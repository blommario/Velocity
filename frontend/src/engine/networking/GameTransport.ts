/**
 * Transport interface for multiplayer networking.
 * Implemented by WebTransportTransport (Web Worker + SharedArrayBuffer).
 *
 * Depends on: nothing
 * Used by: multiplayerStore, cameraTick
 */

// ── Transport interface (engine-generic) ──

export type TransportState = 'disconnected' | 'connecting' | 'open' | 'closed';

export interface IGameTransport {
  connect(url: string, token: string): void;
  sendBinary(buffer: ArrayBuffer): void;
  /** Fire-and-forget position send — writes to SharedArrayBuffer for zero-copy transfer. */
  sendUnreliable(buffer: ArrayBuffer): void;
  sendJson<T extends Record<string, unknown>>(type: string, data?: T): void;
  onBinary(handler: (buffer: ArrayBuffer) => void): void;
  onJson<T>(type: string, handler: (data: T) => void): void;
  offJson(type: string): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onOpen(handler: () => void): void;
  onReconnect(handler: () => void): void;
  onReconnectAttempt(handler: (attempt: number, maxAttempts: number) => void): void;
  resetReconnect(): void;
  disconnect(): void;
  /** Returns the inbound SharedArrayBuffer for position polling, or null if not supported. */
  getInboundBuffer(): SharedArrayBuffer | null;
  readonly state: TransportState;
  readonly latencyMs: number;
  readonly reconnectAttempt: number;
  readonly maxReconnectAttempts: number;
  readonly isReconnecting: boolean;
  readonly supportsUnreliable: boolean;
}

/**
 * Builds an HTTPS URL for WebTransport.
 * In development, connects directly to the backend since Vite cannot proxy HTTP/3.
 * In production, uses the current page host (reverse proxy handles it).
 */
export function buildTransportUrl(path: string): string {
  const isDev = window.location.port === '5173';
  const host = isDev ? 'localhost:5001' : window.location.host;
  return `https://${host}${path}`;
}
