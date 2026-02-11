/**
 * Server-Sent Events client with auto-reconnect and typed event dispatch.
 * Token passed as query parameter since EventSource lacks custom headers.
 *
 * Depends on: ./api (STORAGE_KEYS)
 * Used by: raceStore
 */
import { STORAGE_KEYS } from './api';

const SSE_CONFIG = {
  BASE_PATH: '/api',
  RECONNECT_DELAY_MS: 3000,
  MAX_RECONNECT_ATTEMPTS: 10,
} as const;

interface SseConnection {
  close: () => void;
}

/**
 * Creates a typed SSE stream that auto-reconnects on failure.
 * Returns a cleanup function to close the connection.
 *
 * Note: EventSource does not support custom headers natively.
 * The token is passed as a query parameter for auth.
 */
export function createSseStream<T>(
  path: string,
  onEvent: (event: string, data: T) => void,
  onStatusChange?: (connected: boolean) => void,
): SseConnection {
  let source: EventSource | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect(): void {
    if (closed) return;

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const separator = path.includes('?') ? '&' : '?';
    const url = token
      ? `${SSE_CONFIG.BASE_PATH}${path}${separator}token=${encodeURIComponent(token)}`
      : `${SSE_CONFIG.BASE_PATH}${path}`;

    source = new EventSource(url);

    source.onopen = () => {
      reconnectAttempts = 0;
      onStatusChange?.(true);
    };

    source.onmessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data as string) as T;
        const eventType = e.type || 'message';
        onEvent(eventType, parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    source.onerror = () => {
      source?.close();
      source = null;
      onStatusChange?.(false);

      if (closed) return;

      if (reconnectAttempts < SSE_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, SSE_CONFIG.RECONNECT_DELAY_MS);
      }
    };
  }

  connect();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      source?.close();
      source = null;
      onStatusChange?.(false);
    },
  };
}

/**
 * Creates a typed SSE stream that dispatches to named event handlers.
 * Useful when the server sends different event types (e.g., "countdown", "position", "finish").
 */
export function createTypedSseStream<TEventMap extends Record<string, unknown>>(
  path: string,
  handlers: { [K in keyof TEventMap]?: (data: TEventMap[K]) => void },
  onStatusChange?: (connected: boolean) => void,
): SseConnection {
  return createSseStream<unknown>(
    path,
    (event, data) => {
      const handler = handlers[event];
      if (handler) {
        handler(data as TEventMap[typeof event]);
      }
    },
    onStatusChange,
  );
}
