const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Mock spotsProxy ESM module for Jest CommonJS runner
jest.mock('../src/proxy/spotsProxy', () => (req, res, next) => next());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = require('../src/server');
const prisma = require('../src/lib/prisma');
const { JWT_SECRET } = require('../src/middleware/auth');

describe('Backend Test Suite: Role-Based JWT Authentication & Authorization', () => {
  const testDriverEmail = `driver_${Date.now()}@ghostparking.test`;
  const testHostEmail = `host_${Date.now()}@ghostparking.test`;
  const testPassword = 'SecurePassword123!';

  let driverToken = null;
  let driverUserId = null;
  let hostToken = null;
  let hostUserId = null;

  afterAll(async () => {
    // Cleanup created test records
    try {
      await prisma.parking_spots.deleteMany({
        where: { title: { contains: 'Test JWT Spot' } },
      });
      await prisma.users.deleteMany({
        where: {
          email: { in: [testDriverEmail, testHostEmail] },
        },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
  });

  describe('1. POST /auth/register - Role validation & Password Hashing', () => {
    it('successfully registers a driver with valid role and returns JWT containing id & role', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Speedy Driver',
          email: testDriverEmail,
          password: testPassword,
          role: 'driver',
          phone_number: `+919000000001`,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('driver');
      expect(res.body.user.email).toBe(testDriverEmail);
      expect(res.body.user.password).toBeUndefined(); // Never expose password

      driverToken = res.body.token;
      driverUserId = res.body.user.id;

      // Verify JWT payload
      const decoded = jwt.verify(driverToken, JWT_SECRET);
      expect(decoded.id).toBe(driverUserId);
      expect(decoded.role).toBe('driver');

      // Verify password stored in DB is hashed with bcrypt
      const dbUser = await prisma.users.findUnique({
        where: { id: driverUserId },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser.password).toBeDefined();
      expect(dbUser.password.startsWith('$2b$')).toBe(true);
      expect(dbUser.password).not.toBe(testPassword);
      const isMatch = await bcrypt.compare(testPassword, dbUser.password);
      expect(isMatch).toBe(true);
    });

    it('successfully registers a host with valid role and returns JWT containing host role', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Prime Host',
          email: testHostEmail,
          password: testPassword,
          role: 'host',
          phone_number: `+919000000002`,
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('host');

      hostToken = res.body.token;
      hostUserId = res.body.user.id;

      // Verify JWT payload
      const decoded = jwt.verify(hostToken, JWT_SECRET);
      expect(decoded.id).toBe(hostUserId);
      expect(decoded.role).toBe('host');
    });

    it('strictly rejects registration when role is invalid (not driver or host)', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Invalid Role User',
          email: 'invalid.role@ghostparking.test',
          password: testPassword,
          role: 'admin', // strictly not allowed on public registration
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Role must be strictly either');
    });

    it('rejects registration when required fields are missing', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'noname@ghostparking.test',
          role: 'driver',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required fields');
    });

    it('rejects registration when email already exists (duplicate email)', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Duplicate Driver',
          email: testDriverEmail,
          password: testPassword,
          role: 'driver',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('2. POST /auth/login - Credential Verification & JWT Generation', () => {
    it('successfully logs in with correct email and password and returns JWT', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testDriverEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testDriverEmail);
      expect(res.body.user.role).toBe('driver');

      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.id).toBe(driverUserId);
      expect(decoded.role).toBe('driver');
    });

    it('rejects login when password is incorrect', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testDriverEmail,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('rejects login when email does not exist', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent.user@ghostparking.test',
          password: testPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('rejects login when email or password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testDriverEmail,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });
  });

  describe('3. Middleware: verifyToken & requireHost authorization on POST /spots', () => {
    it('blocks unauthenticated requests to POST /spots (missing token) with 401', async () => {
      const res = await request(app)
        .post('/spots')
        .send({
          title: 'Test Spot Without Token',
          address: 'MG Road, Bangalore',
          latitude: 12.9716,
          longitude: 77.5946,
          hourly_rate: 100,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No authentication token provided');
    });

    it('blocks invalid or tampered JWT token on POST /spots with 401', async () => {
      const res = await request(app)
        .post('/spots')
        .set('Authorization', 'Bearer invalid.tampered.token')
        .send({
          title: 'Test Spot With Invalid Token',
          address: 'MG Road, Bangalore',
          latitude: 12.9716,
          longitude: 77.5946,
          hourly_rate: 100,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid token');
    });

    it('blocks driver role from accessing host-only route POST /spots with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/spots')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          title: 'Test Spot Driver Attempt',
          address: 'Indiranagar, Bangalore',
          latitude: 12.9784,
          longitude: 77.6408,
          hourly_rate: 80,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Host role required');
    });

    it('allows host role to successfully create a spot on POST /spots', async () => {
      const res = await request(app)
        .post('/spots')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Test JWT Spot By Host',
          address: 'Koramangala, Bangalore',
          latitude: 12.9352,
          longitude: 77.6245,
          hourly_rate: 120,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Parking spot created successfully');
      expect(res.body.spot).toBeDefined();
      expect(res.body.spot.title).toBe('Test JWT Spot By Host');
      expect(res.body.spot.host_id).toBe(hostUserId);
    });
  });

  describe('4. GET /auth/me - Authenticated User Profile', () => {
    it('returns current user profile when authenticated with JWT token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(driverUserId);
      expect(res.body.user.role).toBe('driver');
      expect(res.body.user.email).toBe(testDriverEmail);
    });
  });
});
