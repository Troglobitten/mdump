import { ref, readonly } from 'vue';
import type { FileChangeEvent } from '@mdump/shared';

type EventHandler = (event: FileChangeEvent) => void;

const connected = ref(false);
const reconnecting = ref(false);

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const eventHandlers: Set<EventHandler> = new Set();

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

export function useWebSocket() {
  function connect(): void {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        connected.value = true;
        reconnecting.value = false;
        reconnectAttempts = 0;
        console.log('WebSocket connected');
      };

      ws.onclose = () => {
        connected.value = false;
        console.log('WebSocket disconnected');
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const data: FileChangeEvent = JSON.parse(event.data);
          notifyHandlers(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      scheduleReconnect();
    }
  }

  function disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }

    connected.value = false;
    reconnecting.value = false;
  }

  function scheduleReconnect(): void {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max WebSocket reconnect attempts reached');
      return;
    }

    if (reconnectTimeout) {
      return;
    }

    reconnecting.value = true;
    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connect();
    }, RECONNECT_DELAY);
  }

  function subscribe(handler: EventHandler): () => void {
    eventHandlers.add(handler);
    return () => {
      eventHandlers.delete(handler);
    };
  }

  function notifyHandlers(event: FileChangeEvent): void {
    for (const handler of eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in WebSocket event handler:', error);
      }
    }
  }

  return {
    connected: readonly(connected),
    reconnecting: readonly(reconnecting),
    connect,
    disconnect,
    subscribe,
  };
}
