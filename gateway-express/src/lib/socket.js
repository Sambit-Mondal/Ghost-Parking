const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initializes Socket.io with the given HTTP server instance
 * and configures CORS and optional JWT handshake authentication.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT handshake authentication middleware
  io.use((socket, next) => {
    const authHeader = socket.handshake.headers?.authorization;
    const token =
      socket.handshake.auth?.token ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'ghost_parking_jwt_secret_key_2026'
        );
        socket.user = decoded;
      } catch (err) {
        console.warn('[Socket Auth] Unverified client connected:', err.message);
      }
    }
    return next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id || 'anonymous';
    const role = socket.user?.role || 'driver';
    console.log(`[Socket.io] Client connected: ${socket.id} (user: ${userId}, role: ${role})`);

    // Drivers can join a room for driver-specific broadcasts if needed
    if (role === 'driver') {
      socket.join('drivers');
    }

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Returns the active Socket.io instance
 * @returns {import('socket.io').Server | null}
 */
function getIO() {
  return io;
}

/**
 * Broadcasts a newly created parking spot to all connected clients.
 * Emits 'spot_added' (as requested) and 'new_spot_available' for backward compatibility.
 * @param {Object} spot - Geospatial spot object
 */
function broadcastSpotAdded(spot) {
  if (io) {
    console.log(`[Socket.io] Broadcasting 'spot_added' for spot "${spot.title}" (${spot.id})`);
    io.emit('spot_added', spot);
    io.emit('new_spot_available', spot);
  }
}

/**
 * Broadcasts a spot status update (e.g. paused or resumed) to all connected clients.
 * Emits 'spot_updated' with { id, is_active }
 * @param {Object} data - { id: string, is_active: boolean, title?: string }
 */
function broadcastSpotUpdated(data) {
  if (io) {
    console.log(`[Socket.io] Broadcasting 'spot_updated' for spot ID ${data.id} (is_active: ${data.is_active})`);
    io.emit('spot_updated', data);
  }
}

module.exports = {
  initSocket,
  getIO,
  broadcastSpotAdded,
  broadcastNewSpot: broadcastSpotAdded,
  broadcastSpotUpdated,
};
