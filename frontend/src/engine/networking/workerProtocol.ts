/**
 * Message types for communication between the main thread and the network Web Worker.
 *
 * Depends on: GameTransport (TransportState type)
 * Used by: WebTransportTransport, transport.worker
 */

import type { TransportState } from './GameTransport';

/** Messages sent from the main thread to the network worker. */
export type MainToWorkerMsg =
  | {
      type: 'connect';
      url: string;
      token: string;
      outSab: SharedArrayBuffer;
      inSab: SharedArrayBuffer;
      certHash?: string;
    }
  | { type: 'disconnect' }
  | { type: 'send_json'; payload: Record<string, unknown> }
  | { type: 'reset_reconnect' };

/** Messages sent from the network worker to the main thread. */
export type WorkerToMainMsg =
  | { type: 'state_change'; state: TransportState }
  | { type: 'json_message'; msgType: string; data: unknown }
  | { type: 'latency'; ms: number }
  | { type: 'reconnect' }
  | { type: 'reconnect_attempt'; attempt: number; maxAttempts: number }
  | { type: 'closed'; code: number; reason: string }
  | { type: 'error'; message: string };
