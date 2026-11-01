import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from '../config/api';

let socket: Socket | null = null;
let hasLoggedConnectError = false;

export interface SocketConnectionOptions {
  token?: string | null;
}

/**
 * Connects to the Express Gateway WebSocket server.
 * Reuses existing socket if already connected.
 */
export function connectSocket(options?: SocketConnectionOptions): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  const baseUrl = getApiBaseUrl();
  socket = io(baseUrl, {
    transports: ['websocket', 'polling'],
    extraHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
    auth: {
      token: options?.token || undefined,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
    timeout: 8000,
  });

  socket.on('connect', () => {
    hasLoggedConnectError = false;
    console.log('[WebSocket] Connected to gateway socket server:', socket?.id);
  });

  socket.on('connect_error', (error) => {
    // Log once on initial failure to prevent terminal and LogBox spam during reconnections
    if (!hasLoggedConnectError) {
      console.log(`[WebSocket] Connecting to ${baseUrl} failed (${error.message}). Retrying in background...`);
      hasLoggedConnectError = true;
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[WebSocket] Disconnected:', reason);
  });

  return socket;
}

/**
 * Subscribes to the 'spot_added' (and 'new_spot_available') broadcast event.
 * Returns an unsubscribe cleanup function.
 */
export function onSpotAdded(callback: (spot: any) => void): () => void {
  const s = socket || connectSocket();

  s.on('spot_added', callback);
  s.on('new_spot_available', callback);

  return () => {
    s.off('spot_added', callback);
    s.off('new_spot_available', callback);
  };
}

/**
 * Subscribes to the 'spot_updated' broadcast event (when a spot is paused/resumed).
 * Returns an unsubscribe cleanup function.
 */
export function onSpotUpdated(
  callback: (data: { id: string; is_active: boolean; [key: string]: any }) => void
): () => void {
  const s = socket || connectSocket();

  s.on('spot_updated', callback);

  return () => {
    s.off('spot_updated', callback);
  };
}

/**
 * Subscribes to the 'new_spot_available' broadcast event (alias to onSpotAdded).
 * Returns an unsubscribe cleanup function.
 */
export function onNewSpotAvailable(callback: (spot: any) => void): () => void {
  return onSpotAdded(callback);
}

/**
 * Disconnects the active socket connection.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Returns current socket instance.
 */
export function getSocket(): Socket | null {
  return socket;
}

