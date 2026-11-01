// Unmock socketService for this unit test
jest.unmock('../../src/services/socketService');

import { connectSocket, onNewSpotAvailable, disconnectSocket, getSocket } from '../../src/services/socketService';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const listeners: Record<string, Function[]> = {};
  const mockSocket = {
    id: 'mock-socket-id-123',
    connected: true,
    on: jest.fn((event: string, callback: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    off: jest.fn((event: string, callback: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    emit: jest.fn(),
    disconnect: jest.fn(() => {
      mockSocket.connected = false;
    }),
    __trigger: (event: string, data: any) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
  };

  return {
    io: jest.fn(() => mockSocket),
    Socket: mockSocket,
  };
});

describe('Unit Test: socketService', () => {
  afterEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
  });

  it('connects to gateway WebSocket server and returns socket instance', () => {
    const s = connectSocket({ token: 'test-jwt-token' });
    expect(s).toBeDefined();
    expect(s.connected).toBe(true);
    expect(getSocket()).toBe(s);
  });

  it('subscribes to "new_spot_available" event and invokes callback on arrival', () => {
    const mockCallback = jest.fn();
    const unsubscribe = onNewSpotAvailable(mockCallback);

    const s: any = getSocket();
    expect(s.on).toHaveBeenCalledWith('new_spot_available', expect.any(Function));

    const sampleSpot = {
      id: 'spot-sample-1',
      title: 'Koramangala 4th Block Driveway',
      latitude: 12.9352,
      longitude: 77.6245,
      hourly_rate: 70,
    };

    s.__trigger('new_spot_available', sampleSpot);
    expect(mockCallback).toHaveBeenCalledWith(sampleSpot);

    unsubscribe();
    expect(s.off).toHaveBeenCalledWith('new_spot_available', expect.any(Function));
  });

  it('disconnects active socket cleanly', () => {
    connectSocket();
    expect(getSocket()).not.toBeNull();
    disconnectSocket();
    expect(getSocket()).toBeNull();
  });
});

