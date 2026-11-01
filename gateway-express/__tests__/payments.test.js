const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/server');
const prisma = require('../src/lib/prisma');

// Mock ESM proxy middleware for CommonJS Jest test environment
jest.mock('../src/proxy/spotsProxy', () => (req, res, next) => next());

describe('Backend Test Suite: Razorpay Payments & Order Creation Flow', () => {
  let hostUserId;
  let hostToken;
  let driverUserId;
  let driverToken;
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
    hostToken = hostRes.body.token;

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
    driverToken = driverRes.body.token;

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

  it('POST /payments/verify - transitions booking status to active and executes Razorpay Route 80/20 split upon valid HMAC signature', async () => {
    const paymentId = `pay_${Date.now()}`;
    const orderRes = await request(app)
      .post('/payments/create-order')
      .send({
        booking_id: bookingId,
      });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order_id;

    // Verify booking strictly remains 'pending' after order creation
    const pendingBooking = await prisma.bookings.findUnique({ where: { id: bookingId } });
    expect(pendingBooking.status).toBe('pending');

    // Rejection on invalid signature
    const invalidVerifyRes = await request(app)
      .post('/payments/verify')
      .send({
        booking_id: bookingId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: 'invalid_tampered_signature_hex',
      });

    expect(invalidVerifyRes.status).toBe(400);
    expect(invalidVerifyRes.body.error).toBe('Invalid payment signature');

    // Cryptographic HMAC SHA256 signature generation matching Razorpay Standard
    const validSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const verifyRes = await request(app)
      .post('/payments/verify')
      .send({
        booking_id: bookingId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.booking).toBeDefined();
    expect(verifyRes.body.booking.status).toBe('active');
    expect(verifyRes.body.booking.razorpay_payment_id).toBe(paymentId);
    expect(Number(verifyRes.body.booking.total_amount)).toBe(300);

    // Verify Razorpay Route Split payload (80% Host Net / 20% Platform Fee)
    expect(verifyRes.body.route_split).toBeDefined();
    expect(verifyRes.body.route_split.total_amount).toBe(300);
    expect(verifyRes.body.route_split.host_net_earnings_80_percent).toBe(240); // 300 * 0.80
    expect(verifyRes.body.route_split.platform_fee_20_percent).toBe(60); // 300 * 0.20
  });

  it('POST /payments/process-test-card - authorizes dummy card and returns genuine HMAC signature', async () => {
    const orderRes = await request(app)
      .post('/payments/create-order')
      .send({
        booking_id: bookingId,
      });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order_id;

    const cardRes = await request(app)
      .post('/payments/process-test-card')
      .send({
        order_id: orderId,
        card_number: '4000 0000 0000 0002',
        expiry: '12/30',
        cvv: '123',
      });

    expect(cardRes.status).toBe(200);
    expect(cardRes.body.success).toBe(true);
    expect(cardRes.body.razorpay_payment_id).toBeDefined();
    expect(cardRes.body.razorpay_order_id).toBe(orderId);
    expect(cardRes.body.razorpay_signature).toBeDefined();

    // Verify signature with /payments/verify
    const verifyRes = await request(app)
      .post('/payments/verify')
      .send({
        booking_id: bookingId,
        razorpay_order_id: cardRes.body.razorpay_order_id,
        razorpay_payment_id: cardRes.body.razorpay_payment_id,
        razorpay_signature: cardRes.body.razorpay_signature,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
  });

  it('GET /host/earnings - returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/host/earnings');
    expect(res.status).toBe(401);
  });

  it('GET /host/earnings - calculates total net earnings (Sum * 0.80) and recent transactions for host', async () => {
    const res = await request(app)
      .get('/host/earnings')
      .set('Authorization', `Bearer ${hostToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.host_id).toBe(hostUserId);

    // 1 active booking with total_amount 300
    // Net: 300 * 0.80 = 240, Platform: 60
    expect(res.body.total_gross_earnings).toBe(300);
    expect(res.body.total_net_earnings).toBe(240);
    expect(res.body.platform_fee_deducted).toBe(60);
    expect(res.body.active_bookings_count).toBe(1);

    expect(Array.isArray(res.body.recent_transactions)).toBe(true);
    expect(res.body.recent_transactions.length).toBeGreaterThan(0);

    const tx = res.body.recent_transactions[0];
    expect(tx.booking_id).toBe(bookingId);
    expect(tx.spot_title).toBe('Payment Flow Test Bay');
    expect(tx.gross_amount).toBe(300);
    expect(tx.host_net_earnings).toBe(240);
    expect(tx.platform_fee).toBe(60);
    expect(tx.status).toBe('active');
  });

  it('POST /payments/webhook - processes payment.captured event and executes Route split', async () => {
    const webhookRes = await request(app)
      .post('/payments/webhook')
      .send({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_webhook_${Date.now()}`,
              amount: 30000,
              notes: {
                booking_id: bookingId,
              },
            },
          },
        },
      });

    expect(webhookRes.status).toBe(200);
    expect(['split_completed', 'ok']).toContain(webhookRes.body.status);
    if (webhookRes.body.status === 'split_completed') {
      expect(webhookRes.body.route_split).toBeDefined();
      expect(webhookRes.body.route_split.hostShareRupees).toBe(240);
    }
  });
});
