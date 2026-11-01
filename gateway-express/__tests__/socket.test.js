const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Mock spotsProxy ESM module for Jest CommonJS runner
jest.mock('../src/proxy/spotsProxy', () => (req, res, next) => next());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const prisma = require('../src/lib/prisma');
const { JWT_SECRET } = require('../src/middleware/auth');

// Support loading socket.io-client from local or mobile node_modules
let ioClient;
try {
  ioClient = require('socket.io-client');
} catch {
  ioClient = require('../../mobile/node_modules/socket.io-client');
}
const { io } = ioClient;

describe('Backend Test Suite: Real-Time WebSocket Spot Broadcasts', () => {
  let serverInstance;
  let serverPort;
  let clientSocket;
  const mockHostId = '11111111-2222-3333-4444-555555555555';
  let hostToken;

  beforeAll((done) => {
    // 1. Generate valid Host JWT Token
    hostToken = jwt.sign(
      { id: mockHostId, role: 'host' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Mock Prisma methods so socket broadcasting is tested deterministically
    jest.spyOn(prisma.users, 'findUnique').mockResolvedValue({
      id: mockHostId,
      name: 'Live Verified Host',
      email: 'host_live_ws@test.com',
      role: 'host',
    });

    jest.spyOn(prisma, '$queryRaw').mockResolvedValue([
      {
        id: 'spot-uuid-ws-777',
        host_id: mockHostId,
        title: 'Indiranagar Live Driveway Bay',
        address: '100ft Road, 12th Main, Indiranagar, Bengaluru',
        latitude: 12.9784,
        longitude: 77.6408,
        hourly_rate: 110,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    // 3. Start HTTP + WebSocket server on an ephemeral port
    serverInstance = app.server.listen(0, () => {
      serverPort = serverInstance.address().port;

      // 4. Connect a driver WebSocket client
      clientSocket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        reconnection: false,
        auth: { token: 'mock-driver-token' },
      });

      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('connect_error', (err) => {
        done(err);
      });
    });
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    jest.restoreAllMocks();
  });

  it('connects to WebSocket server successfully', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('broadcasts "spot_added" event when host creates a spot via POST /spots', (done) => {
    const spotPayload = {
      title: 'Indiranagar Live Driveway Bay',
      address: '100ft Road, 12th Main, Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
      hourly_rate: 110,
    };

    // Set up WebSocket event listener to receive the broadcasted spot
    clientSocket.once('spot_added', (data) => {
      try {
        expect(data).toBeDefined();
        expect(data.id).toBe('spot-uuid-ws-777');
        expect(data.title).toBe(spotPayload.title);
        expect(data.address).toBe(spotPayload.address);
        expect(data.latitude).toBeCloseTo(12.9784, 4);
        expect(data.longitude).toBeCloseTo(77.6408, 4);
        expect(data.hourly_rate).toBe(110);
        expect(data.is_active).toBe(true);
        expect(data.available_slots).toBe(1);
        done();
      } catch (err) {
        done(err);
      }
    });

    // Host submits POST /spots
    request(app)
      .post('/spots')
      .set('Authorization', `Bearer ${hostToken}`)
      .send(spotPayload)
      .expect(201)
      .then((res) => {
        expect(res.body.spot).toBeDefined();
        expect(res.body.spot.title).toBe(spotPayload.title);
      })
      .catch((err) => done(err));
  });

  it('broadcasts "spot_updated" event when host pauses a spot via PATCH /spots/:id/pause', (done) => {
    const targetSpotId = '67e92b3b-0da0-436b-9f49-ea24e4fc89ee';

    jest.spyOn(prisma.parking_spots, 'findUnique').mockResolvedValue({
      id: targetSpotId,
      title: 'Central Parking MG Road',
      hourly_rate: 50,
      is_active: true,
    });

    jest.spyOn(prisma.parking_spots, 'update').mockResolvedValue({
      id: targetSpotId,
      title: 'Central Parking MG Road',
      hourly_rate: 50,
      is_active: false,
    });

    // Client listens for 'spot_updated'
    clientSocket.once('spot_updated', (data) => {
      try {
        expect(data).toBeDefined();
        expect(data.id).toBe(targetSpotId);
        expect(data.is_active).toBe(false);
        done();
      } catch (err) {
        done(err);
      }
    });

    request(app)
      .patch(`/spots/${targetSpotId}/pause`)
      .send({ is_active: false })
      .expect(200)
      .then((res) => {
        expect(res.body.spot.is_active).toBe(false);
      })
      .catch((err) => done(err));
  });
});
