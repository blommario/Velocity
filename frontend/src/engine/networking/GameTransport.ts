/**
 * WebSocket transport abstraction for multiplayer.
 * Provides binary + JSON messaging, auto-reconnect with exponential backoff,
 * and ping/pong latency measurement.
 *
 * Depends on: PositionCodec (MSG_TYPE), STORAGE_KEYS from api.ts
 * Used by: raceStore
 */

import { MSG_TYPE } from './PositionCodec';

// ── Transport interface (engine-generic, future WebTransport swap) ──

export type TransportState = 'disconnected' | 'connecting' | 'open' | 'closed';

export interface IGameTransport {
  connect(url: string, token: string): void;
  sendBinary(buffer: ArrayBuffer): void;
  sendJson<T extends Record<string, unknown>>(type: string, data?: T): void;
  onBinary(handler: (buffer: ArrayBuffer) => void): void;
  onJson<T>(type: string, handler: (data: T) => void): void;
  offJson(type: string): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onOpen(handler: () => void): void;
  disconnect(): void;
  readonly state: TransportState;
  readonly latencyMs: number;
}

// ── WebSocket implementation ──

const RECONNECT_CONFIG = {
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 16000,
  MAX_ATTEMPTS: 10,
  PING_INTERVAL_MS: 5000,
} as const;

type JsonHandler = (data: unknown) => void;

export class WebSocketTransport implements IGameTransport {
  private _ws: WebSocket | null = null;
  private _state: TransportState = 'disconnected';
  private _latencyMs = 0;
  private _url = '';
  private _token = '';
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _closed = false;

  private _binaryHandler: ((buffer: ArrayBuffer) => void) | null = null;
  private _jsonHandlers = new Map<string, JsonHandler>();
  private _closeHandler: ((code: number, reason: string) => void) | null = null;
  private _openHandler: (() => void) | null = null;

  get state(): TransportState {
    return this._state;
  }

  get latencyMs(): number {
    return this._latencyMs;
  }

  connect(url: string, token: string): void {
    this._url = url;
    this._token = token;
    this._closed = false;
    this._reconnectAttempts = 0;
    this._doConnect();
  }

  disconnect(): void {
    this._closed = true;
    this._stopPing();
    this._clearReconnect();

    if (this._ws) {
      if (this._ws.readyState === WebSocket.OPEN) {
        this._ws.close(1000, 'Client disconnect');
      }
      this._ws = null;
    }

    this._state = 'disconnected';
  }

  sendBinary(buffer: ArrayBuffer): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(buffer);
    }
  }

  sendJson<T extends Record<string, unknown>>(type: string, data?: T): void {
    if (this._ws?.readyState !== WebSocket.OPEN) return;

    const payload = JSON.stringify({ type, ...data });
    const bytes = new TextEncoder().encode(payload);

    // Frame: [0x80 (JSON marker)] + UTF-8 payload
    const frame = new Uint8Array(1 + bytes.length);
    frame[0] = MSG_TYPE.JSON;
    frame.set(bytes, 1);

    this._ws.send(frame.buffer);
  }

  onBinary(handler: (buffer: ArrayBuffer) => void): void {
    this._binaryHandler = handler;
  }

  onJson<T>(type: string, handler: (data: T) => void): void {
    this._jsonHandlers.set(type, handler as JsonHandler);
  }

  offJson(type: string): void {
    this._jsonHandlers.delete(type);
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this._closeHandler = handler;
  }

  onOpen(handler: () => void): void {
    this._openHandler = handler;
  }

  // ── Internal ──

  private _doConnect(): void {
    if (this._closed) return;

    this._state = 'connecting';

    // Build WebSocket URL with token as query param
    const separator = this._url.includes('?') ? '&' : '?';
    const wsUrl = `${this._url}${separator}token=${encodeURIComponent(this._token)}`;

    this._ws = new WebSocket(wsUrl);
    this._ws.binaryType = 'arraybuffer';

    this._ws.onopen = () => {
      this._state = 'open';
      this._reconnectAttempts = 0;
      this._startPing();
      this._openHandler?.();
    };

    this._ws.onmessage = (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        this._handleBinaryMessage(e.data);
      }
    };

    this._ws.onclose = (e: CloseEvent) => {
      this._stopPing();
      this._state = 'closed';
      this._closeHandler?.(e.code, e.reason);

      if (!this._closed) {
        this._scheduleReconnect();
      }
    };

    this._ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private _handleBinaryMessage(buffer: ArrayBuffer): void {
    const view = new Uint8Array(buffer);
    if (view.length === 0) return;

    const msgType = view[0];

    if (msgType === MSG_TYPE.POSITION_BATCH) {
      // Binary position batch
      this._binaryHandler?.(buffer);
    } else if (msgType === MSG_TYPE.JSON) {
      // JSON message (skip first byte)
      const jsonBytes = buffer.slice(1);
      try {
        const text = new TextDecoder().decode(jsonBytes);
        const parsed = JSON.parse(text) as { type?: string; [key: string]: unknown };
        const type = parsed.type;

        if (type === 'pong') {
          // Clock calibration response
          const t = parsed.t as number;
          const rtt = Date.now() - t;
          this._latencyMs = Math.round(rtt / 2);
          return;
        }

        if (type) {
          const handler = this._jsonHandlers.get(type);
          handler?.(parsed.data ?? parsed);
        }
      } catch {
        // Malformed JSON — ignore
      }
    }
  }

  private _startPing(): void {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      this.sendJson('ping', { t: Date.now() } as Record<string, unknown>);
    }, RECONNECT_CONFIG.PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this._pingTimer !== null) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectAttempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) return;

    const delay = Math.min(
      RECONNECT_CONFIG.BASE_DELAY_MS * Math.pow(2, this._reconnectAttempts),
      RECONNECT_CONFIG.MAX_DELAY_MS,
    );

    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => this._doConnect(), delay);
  }

  private _clearReconnect(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

/**
 * Creates a WebSocket URL from the current page location.
 * Handles ws:// vs wss:// based on page protocol.
 */
export function buildWsUrl(path: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}
