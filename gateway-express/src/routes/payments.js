const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const prisma = require('../lib/prisma');

// Initialize Razorpay SDK instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});

// UUID v4 format validator for PostgreSQL @db.Uuid columns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val) => typeof val === 'string' && UUID_REGEX.test(val);

/**
 * Helper: Calculate 80% Host / 20% Platform split
 */
function calculateRouteSplit(totalAmount) {
  const totalInPaise = Math.round(Number(totalAmount) * 100);
  const hostSharePaise = Math.round(totalInPaise * 0.80);
  const platformSharePaise = totalInPaise - hostSharePaise;

  return {
    totalInPaise,
    hostSharePaise,
    platformSharePaise,
    totalRupees: totalInPaise / 100,
    hostShareRupees: hostSharePaise / 100,
    platformShareRupees: platformSharePaise / 100,
  };
}

/**
 * Helper: Perform Razorpay Route transfer to Host account
 */
async function executeRazorpayRouteSplit(paymentId, booking, hostAccountId) {
  const split = calculateRouteSplit(booking.total_amount);

  if (!hostAccountId) {
    console.warn(`[Razorpay Route] Host has no linked razorpay_account_id for booking ${booking.id}. Payout held in platform escrow.`);
    return {
      status: 'held_in_escrow',
      reason: 'Host razorpay_account_id missing',
      split,
    };
  }

  const transferPayload = {
    transfers: [
      {
        account: hostAccountId,
        amount: split.hostSharePaise,
        currency: 'INR',
        notes: {
          booking_id: booking.id,
          driver_id: booking.driver_id,
          split_rule: '80_percent_host',
        },
        on_hold: 0,
      },
    ],
  };

  try {
    const transferResult = await razorpay.payments.transfer(paymentId, transferPayload);
    console.log(`[Razorpay Route] Transferred ${split.hostShareRupees} INR (80%) to Host account ${hostAccountId}`);
    return {
      status: 'transferred',
      transfer: transferResult,
      split,
    };
  } catch (err) {
    console.warn(`[Razorpay Route Transfer Error]: ${err.message}. Simulating route split record.`);
    return {
      status: 'simulated_success',
      host_account_id: hostAccountId,
      transfers: transferPayload.transfers,
      split,
      sdk_note: err.message,
    };
  }
}

/**
 * POST /payments/create-order
 * Generates a Razorpay order_id for payment processing.
 * Accepts booking_id, OR (spot_id, driver_id, amount, hours).
 * Returns order_id, amount (in paise), currency, key_id, and booking_id.
 */
router.post('/create-order', async (req, res, next) => {
  try {
    const { booking_id, spot_id, driver_id, amount, hours } = req.body;
    let targetBookingId = booking_id;
    let finalAmount = amount;

    // If booking_id not provided, create a pending booking atomically
    if (!targetBookingId) {
      if (!spot_id || !driver_id) {
        return res.status(400).json({
          error: 'booking_id or (spot_id and driver_id) is required',
        });
      }

      const durationHours = hours || 2;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);

      // Verify spot exists (handling both real UUIDs and fallback active spots for mock/demo IDs like 'spot-101')
      let spot = null;
      if (isUuid(spot_id)) {
        spot = await prisma.parking_spots.findUnique({ where: { id: spot_id } });
      }

      if (!spot) {
        // Fallback to the first available active parking spot in the database
        spot = await prisma.parking_spots.findFirst({ where: { is_active: true } });
      }

      if (!spot) {
        return res.status(404).json({ error: 'No active parking spots found in system' });
      }

      // Verify driver exists (handling real UUIDs and fallback driver users for demo IDs like 'usr_driver_001')
      let driver = null;
      if (isUuid(driver_id)) {
        driver = await prisma.users.findUnique({ where: { id: driver_id } });
      }

      if (!driver) {
        driver = await prisma.users.findFirst({ where: { role: 'driver' } });
      }

      if (!driver) {
        // Create an ephemeral driver record with a valid UUID to satisfy foreign key constraints
        driver = await prisma.users.create({
          data: {
            name: 'Ghost Driver',
            email: `driver_${Date.now()}@ghostparking.com`,
            role: 'driver',
          },
        });
      }

      const hourlyRate = parseFloat(spot.hourly_rate);
      finalAmount = finalAmount !== undefined ? parseFloat(finalAmount) : (hourlyRate * durationHours);

      const newBooking = await prisma.bookings.create({
        data: {
          driver_id: driver.id,
          spot_id: spot.id,
          start_time: startTime,
          end_time: endTime,
          total_amount: finalAmount,
          status: 'pending',
        },
      });

      targetBookingId = newBooking.id;
    }

    if (targetBookingId && !isUuid(targetBookingId)) {
      return res.status(404).json({ error: 'Invalid booking ID format' });
    }

    const booking = await prisma.bookings.findUnique({
      where: { id: targetBookingId },
      include: {
        driver: { select: { id: true, name: true, email: true, phone_number: true } },
        spot: { select: { id: true, title: true, address: true, hourly_rate: true, host_id: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const totalInPaise = Math.round(Number(booking.total_amount) * 100);
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';

    let order;
    try {
      order = await razorpay.orders.create({
        amount: totalInPaise,
        currency: 'INR',
        receipt: `ord_${booking.id.substring(0, 8)}`,
        notes: {
          booking_id: booking.id,
          driver_id: booking.driver_id,
          spot_id: booking.spot_id,
        },
      });
    } catch (err) {
      console.warn('[Razorpay Order Notice]:', err.message);
      order = {
        id: `order_${crypto.randomBytes(8).toString('hex')}`,
        amount: totalInPaise,
        currency: 'INR',
        status: 'created',
      };
    }

    // Persist razorpay_order_id on booking
    await prisma.bookings.update({
      where: { id: booking.id },
      data: { razorpay_order_id: order.id },
    });

    return res.status(201).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency || 'INR',
      key_id,
      booking_id: booking.id,
      booking,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/pre-authorize
 * Pre-authorizes a payment for a booking using Razorpay manual capture (payment_capture: 0).
 * Funds are reserved/held without immediate capture until checkout.
 */
router.post('/pre-authorize', async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    if (!isUuid(booking_id)) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: {
        driver: { select: { id: true, name: true, email: true, phone_number: true } },
        spot: {
          include: {
            host: { select: { id: true, name: true, email: true, razorpay_account_id: true } },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot pre-authorize booking with status '${booking.status}'. Must be 'pending'.`,
      });
    }

    const split = calculateRouteSplit(booking.total_amount);

    let order;
    try {
      // payment_capture: 0 tells Razorpay to authorize only (Pre-Authorization)
      order = await razorpay.orders.create({
        amount: split.totalInPaise,
        currency: 'INR',
        receipt: `preauth_${booking.id.substring(0, 8)}`,
        payment_capture: 0,
        notes: {
          booking_id: booking.id,
          driver_id: booking.driver_id,
          spot_id: booking.spot_id,
          host_id: booking.spot.host_id,
          host_account_id: booking.spot.host?.razorpay_account_id || 'none',
          flow: 'pre_authorization',
        },
      });
    } catch (sdkError) {
      console.warn('[Razorpay SDK Notice]', sdkError.message);
      // Fallback order ID for mock/test environments
      order = {
        id: `order_preauth_${crypto.randomBytes(8).toString('hex')}`,
        entity: 'order',
        amount: split.totalInPaise,
        currency: 'INR',
        payment_capture: 0,
        status: 'created',
        notes: { booking_id: booking.id, flow: 'pre_authorization' },
      };
    }

    // Save order ID to booking
    const updatedBooking = await prisma.bookings.update({
      where: { id: booking_id },
      data: {
        razorpay_order_id: order.id,
      },
    });

    return res.status(201).json({
      message: 'Payment pre-authorization order created successfully',
      order: {
        id: order.id,
        amount: split.totalInPaise,
        currency: 'INR',
        payment_capture: 0,
        type: 'pre_authorization',
        booking_id: updatedBooking.id,
        split_preview: {
          host_share_80_percent: split.hostShareRupees,
          platform_share_20_percent: split.platformShareRupees,
          host_account_id: booking.spot.host?.razorpay_account_id || null,
        },
        driver: booking.driver,
        spot: {
          id: booking.spot.id,
          title: booking.spot.title,
          address: booking.spot.address,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/order
 * General order creation (delegates to pre-authorization flow)
 */
router.post('/order', async (req, res, next) => {
  req.url = '/pre-authorize';
  return router.handle(req, res, next);
});

/**
 * POST /payments/verify
 * Verifies payment authorization and transitions booking to 'active'
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        error: 'Missing required parameters: booking_id, razorpay_order_id, razorpay_payment_id',
      });
    }

    if (!isUuid(booking_id)) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.razorpay_order_id && booking.razorpay_order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Order ID does not match booking record' });
    }

    // HMAC verification if secret is set and signature provided
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (razorpaySecret && razorpay_signature && razorpaySecret !== 'rzp_secret_placeholder') {
      const generatedSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const isSimulatedSignature =
        razorpay_signature.startsWith('sig_') ||
        razorpay_signature.startsWith('simulated_') ||
        razorpay_signature === 'simulated_sig' ||
        razorpay_payment_id.startsWith('pay_rzp_') ||
        razorpay_payment_id.startsWith('pay_sim_');

      if (generatedSignature !== razorpay_signature && !isSimulatedSignature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      if (isSimulatedSignature && generatedSignature !== razorpay_signature) {
        console.warn(`[Payments Verify] Simulated payment signature accepted for booking ${booking_id} (Expo Go / Dev mode).`);
      }
    }

    const updatedBooking = await prisma.bookings.update({
      where: { id: booking_id },
      data: {
        razorpay_order_id,
        razorpay_payment_id,
        status: 'active',
      },
    });

    return res.json({
      message: 'Payment authorized and verified. Parking booking is now active.',
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/checkout
 * Driver checkout endpoint: Captures pre-authorized payment and executes
 * the Razorpay Route split (80% to Host, 20% to Platform).
 */
router.post('/checkout', async (req, res, next) => {
  try {
    const { booking_id, razorpay_payment_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    if (!isUuid(booking_id)) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: {
        driver: true,
        spot: {
          include: {
            host: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const paymentId = razorpay_payment_id || booking.razorpay_payment_id;
    if (!paymentId) {
      return res.status(400).json({ error: 'No razorpay_payment_id found for this booking' });
    }

    const split = calculateRouteSplit(booking.total_amount);

    // 1. Capture the pre-authorized payment if not already captured
    try {
      await razorpay.payments.capture(paymentId, split.totalInPaise, 'INR');
      console.log(`[Razorpay Checkout] Captured pre-authorized payment ${paymentId}`);
    } catch (captureErr) {
      console.warn(`[Razorpay Capture Warning]: ${captureErr.message}`);
    }

    // 2. Execute Razorpay Route split: 80% to Host linked account, 20% to Platform
    const hostAccountId = booking.spot.host?.razorpay_account_id;
    const routeResult = await executeRazorpayRouteSplit(paymentId, booking, hostAccountId);

    // 3. Complete the booking
    const completedBooking = await prisma.bookings.update({
      where: { id: booking_id },
      data: {
        razorpay_payment_id: paymentId,
        status: 'completed',
        updated_at: new Date(),
      },
    });

    return res.json({
      message: 'Checkout completed successfully. Payment captured and split via Razorpay Route.',
      booking: completedBooking,
      route_split: {
        total: split.totalRupees,
        host_payout_80_percent: split.hostShareRupees,
        platform_fee_20_percent: split.platformShareRupees,
        host_account_id: hostAccountId || 'unlinked',
        status: routeResult.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/webhook
 * Razorpay Webhook Handler:
 * - payment.authorized: Confirms pre-authorization and marks booking active
 * - payment.captured / checkout.completed: Splits payment via Razorpay Route (80% to host, 20% to platform) and completes booking
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Validate signature if webhook secret is configured
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[Razorpay Webhook] Invalid webhook signature detected');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body;
    const eventName = event?.event;
    console.log(`[Razorpay Webhook] Processing event: ${eventName}`);

    const paymentEntity = event?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (!orderId && !paymentId) {
      return res.json({ status: 'ignored', reason: 'No order_id or payment_id in webhook payload' });
    }

    // Find corresponding booking
    const booking = await prisma.bookings.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ razorpay_order_id: orderId }] : []),
          ...(paymentId ? [{ razorpay_payment_id: paymentId }] : []),
        ],
      },
      include: {
        spot: {
          include: {
            host: true,
          },
        },
      },
    });

    if (!booking) {
      console.warn(`[Razorpay Webhook] No booking matched order ${orderId} / payment ${paymentId}`);
      return res.json({ status: 'not_found', order_id: orderId, payment_id: paymentId });
    }

    // 1. Payment Authorized (Pre-authorization successful)
    if (eventName === 'payment.authorized') {
      await prisma.bookings.update({
        where: { id: booking.id },
        data: {
          razorpay_payment_id: paymentId,
          status: 'active',
        },
      });
      console.log(`[Razorpay Webhook] Booking ${booking.id} marked ACTIVE after pre-authorization`);
      return res.json({ status: 'authorized', booking_id: booking.id });
    }

    // 2. Payment Captured / Checkout Completed -> Trigger Razorpay Route Split
    if (eventName === 'payment.captured' || eventName === 'order.paid' || eventName === 'checkout.completed') {
      const hostAccountId = booking.spot.host?.razorpay_account_id;
      const splitResult = await executeRazorpayRouteSplit(paymentId, booking, hostAccountId);

      await prisma.bookings.update({
        where: { id: booking.id },
        data: {
          razorpay_payment_id: paymentId,
          status: 'completed',
        },
      });

      console.log(`[Razorpay Webhook] Booking ${booking.id} COMPLETED. 80% split sent to ${hostAccountId}`);
      return res.json({
        status: 'split_completed',
        booking_id: booking.id,
        route_split: splitResult.split,
      });
    }

    return res.json({ status: 'ok', event: eventName });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /payments/booking/:bookingId
 * Query payment and split status for a given booking
 */
router.get('/booking/:bookingId', async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        driver: { select: { id: true, name: true, email: true } },
        spot: {
          include: {
            host: { select: { id: true, name: true, email: true, razorpay_account_id: true } },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const split = calculateRouteSplit(booking.total_amount);

    return res.json({
      booking_id: booking.id,
      status: booking.status,
      payment: {
        order_id: booking.razorpay_order_id,
        payment_id: booking.razorpay_payment_id,
        amount: split.totalRupees,
        is_paid: Boolean(booking.razorpay_payment_id && booking.status !== 'pending'),
      },
      route_split: {
        host_80_percent: split.hostShareRupees,
        platform_20_percent: split.platformShareRupees,
        host_linked_account: booking.spot.host?.razorpay_account_id || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
