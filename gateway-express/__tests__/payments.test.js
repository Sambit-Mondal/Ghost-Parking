const request = require('supertest');
const app = require('../src/server');
const prisma = require('../src/lib/prisma');

// Mock ESM proxy middleware for CommonJS Jest test environment
jest.mock('../src/proxy/spotsProxy', () => (req, res, next) => next());

describe('Backend Test Suite: Razorpay Payments & Order Creation Flow', () => {
  let hostUserId;
  let driverUserId;
  let spotId;
  let bookingId;

  beforeAll(async () => {
    // 1. Create a test host user
    const hostRes = await request(app)
      .post('/auth/register')
      .send({
        name: 'Payment Test Host',
        email: `host_pay_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'host',
      });
    hostUserId = hostRes.body.user.id;

    // 2. Create a test driver user
    const driverRes = await request(app)
      .post('/auth/register')
      .send({
        name: 'Payment Test Driver',
        email: `driver_pay_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'driver',
      });
    driverUserId = driverRes.body.user.id;

    // 3. Create a parking spot
    const spotRes = await request(app)
      .post('/spots')
      .set('Authorization', `Bearer ${hostRes.body.token}`)
      .send({
        title: 'Payment Flow Test Bay',
        address: '100 MG Road, Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        hourly_rate: 100,
      });
    spotId = spotRes.body.spot.id;
  });

  afterAll(async () => {
    try {
      if (bookingId) {
        await prisma.bookings.deleteMany({ where: { id: bookingId } });
      }
      if (spotId) {
        await prisma.parking_spots.deleteMany({ where: { id: spotId } });
      }
      if (driverUserId || hostUserId) {
        await prisma.users.deleteMany({
          where: { id: { in: [driverUserId, hostUserId].filter(Boolean) } },
        });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('POST /payments/create-order - generates Razorpay order_id from spot_id and driver_id', async () => {
    const res = await request(app)
      .post('/payments/create-order')
      .send({
        spot_id: spotId,
        driver_id: driverUserId,
        hours: 3,
        amount: 300,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order_id).toBeDefined();
    expect(res.body.amount).toBe(30000); // 300 INR in paise
    expect(res.body.currency).toBe('INR');
    expect(res.body.key_id).toBeDefined();
    expect(res.body.booking_id).toBeDefined();

    bookingId = res.body.booking_id;
  });

  it('POST /payments/verify - transitions booking status to active upon valid callback', async () => {
    const paymentId = `pay_${Date.now()}`;
    const orderRes = await request(app)
      .post('/payments/create-order')
      .send({
        booking_id: bookingId,
      });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order_id;

    const verifyRes = await request(app)
      .post('/payments/verify')
      .send({
        booking_id: bookingId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.booking).toBeDefined();
    expect(verifyRes.body.booking.status).toBe('active');
    expect(verifyRes.body.booking.razorpay_payment_id).toBe(paymentId);
  });
});
