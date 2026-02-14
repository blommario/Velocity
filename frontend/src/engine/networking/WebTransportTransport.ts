/**
 * WebTransport implementation of IGameTransport.
 * Proxies all networking through a dedicated Web Worker for off-main-thread operation.
 * Uses SharedArrayBuffer for zero-copy position data transfer.
 *
 * Outbound positions: main thread writes to outbound SAB, worker reads at 20Hz and sends.
 * Inbound positions: worker writes to inbound SAB, main thread polls at 60fps.
 * JSON control messages: relayed via postMessage (rare, low frequency).
 *
 * Depends on: GameTransport (IGameTransport), SharedPositionBuffer, workerProtocol, NetworkConstants
 * Used by: multiplayerStore
 */

import type { IGameTransport, TransportState } from './GameTransport';
import { createOutboundBuffer, createInboundBuffer, writeOutboundPosition } from './SharedPositionBuffer';
import { TRANSPORT_CONFIG } from './NetworkConstants';
import type { WorkerToMainMsg } from './workerProtocol';

type JsonHandler = (data: unknown) => void;

export class WebTransportTransport implements IGameTransport {
  private _worker: Worker | null = null;
  private _state: TransportState = 'disconnected';
  private _latencyMs = 0;
  private _reconnectAttempts = 0;
  private _closed = false;

  private _outSab: SharedArrayBuffer | null = null;
  private _inSab: SharedArrayBuffer | null = null;

  private _binaryHandler: ((buffer: ArrayBuffer) => void) | null = null;
  private _jsonHandlers = new Map<string, JsonHandler>();
  private _closeHandler: ((code: number, reason: string) => void) | null = null;
  private _openHandler: (() => void) | null = null;
  private _reconnectHandler: (() => void) | null = null;
  private _reconnectAttemptHandler: ((attempt: number, maxAttempts: number) => void) | null = null;

  get state(): TransportState {
    return this._state;
  }

  get latencyMs(): number {
    return this._latencyMs;
  }

  get reconnectAttempt(): number {
    return this._reconnectAttempts;
  }

  get maxReconnectAttempts(): number {
    return TRANSPORT_CONFIG.RECONNECT_MAX_ATTEMPTS;
  }

  get isReconnecting(): boolean {
    return this._reconnectAttempts > 0 && !this._closed && this._state !== 'open';
  }

  get supportsUnreliable(): boolean {
    return true;
  }

  connect(url: string, token: string): void {
    this._closed = false;
    this._reconnectAttempts = 0;

    // Create SharedArrayBuffers for zero-copy position data
    this._outSab = createOutboundBuffer();
    this._inSab = createInboundBuffer();

    // Spawn the network worker
    this._worker = new Worker(
      new URL('./transport.worker.ts', import.meta.url),
      { type: 'module' },
    );

    this._worker.onmessage = (e: MessageEvent<WorkerToMainMsg>) => {
      this._handleWorkerMessage(e.data);
    };

    this._worker.onerror = () => {
      // Worker crash — will trigger state change via cleanup
    };

    // Tell worker to connect
    this._worker.postMessage({
      type: 'connect',
      url,
      token,
      outSab: this._outSab,
      inSab: this._inSab,
    });
  }

  disconnect(): void {
    this._closed = true;

    if (this._worker) {
      this._worker.postMessage({ type: 'disconnect' });
      this._worker.terminate();
      this._worker = null;
    }

    this._state = 'disconnected';
  }

  /**
   * Writes position data to the outbound SharedArrayBuffer.
   * Zero-copy: no postMessage overhead. Worker reads at 20Hz.
   */
  sendUnreliable(buffer: ArrayBuffer): void {
    if (this._outSab && this._state === 'open') {
      writeOutboundPosition(this._outSab, buffer);
    }
  }

  /** Sends reliable binary data via the worker (postMessage with transferable). */
  sendBinary(buffer: ArrayBuffer): void {
    // For reliable binary (not position data), fall through to sendUnreliable
    // since all binary in this system is position data
    this.sendUnreliable(buffer);
  }

  sendJson<T extends Record<string, unknown>>(type: string, data?: T): void {
    if (this._worker && this._state === 'open') {
      this._worker.postMessage({
        type: 'send_json',
        payload: { type, ...data },
      });
    }
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

  onReconnect(handler: () => void): void {
    this._reconnectHandler = handler;
  }

  onReconnectAttempt(handler: (attempt: number, maxAttempts: number) => void): void {
    this._reconnectAttemptHandler = handler;
  }

  resetReconnect(): void {
    this._reconnectAttempts = 0;
    this._worker?.postMessage({ type: 'reset_reconnect' });
  }

  /** Returns the inbound SAB for position polling (used by the render loop). */
  getInboundBuffer(): SharedArrayBuffer | null {
    return this._inSab;
  }

  // ── Internal ──

  private _handleWorkerMessage(msg: WorkerToMainMsg): void {
    switch (msg.type) {
      case 'state_change':
        this._state = msg.state;
        if (msg.state === 'open') {
          this._openHandler?.();
        }
        break;

      case 'json_message': {
        const handler = this._jsonHandlers.get(msg.msgType);
        handler?.(msg.data);
        break;
      }

      case 'latency':
        this._latencyMs = msg.ms;
        break;

      case 'reconnect':
        this._reconnectHandler?.();
        break;

      case 'reconnect_attempt':
        this._reconnectAttempts = msg.attempt;
        this._reconnectAttemptHandler?.(msg.attempt, msg.maxAttempts);
        break;

      case 'closed':
        this._closeHandler?.(msg.code, msg.reason);
        break;

      case 'error':
        // Log via devLog if available, otherwise ignore
        break;
    }
  }
}
