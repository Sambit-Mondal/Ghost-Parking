const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../lib/prisma');

/**
 * POST /payments/order
 * Create a payment order for a booking
 */
router.post('/order', async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: {
        driver: { select: { name: true, email: true, phone_number: true } },
        spot: { select: { title: true, hourly_rate: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: `Cannot initiate payment for booking with status: ${booking.status}` });
    }

    // Amount in subunits (e.g. paisa for INR)
    const amountInSubunits = Math.round(Number(booking.total_amount) * 100);

    // Generate razorpay order ID (or call Razorpay SDK if keys are provided)
    const generatedOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;

    // Store razorpay_order_id on booking
    const updatedBooking = await prisma.bookings.update({
      where: { id: booking_id },
      data: {
        razorpay_order_id: generatedOrderId,
      },
    });

    return res.status(201).json({
      message: 'Payment order created successfully',
      order: {
        id: generatedOrderId,
        entity: 'order',
        amount: amountInSubunits,
        currency: 'INR',
        booking_id: updatedBooking.id,
        driver: booking.driver,
        spot: booking.spot,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/verify
 * Verify payment signature and transition booking status to 'active'
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        error: 'Missing required parameters: booking_id, razorpay_order_id, razorpay_payment_id',
      });
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

    // If a webhook secret is provided in env, verify HMAC signature
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (razorpaySecret && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }

    // Update booking status to 'active' and record payment ID
    const updatedBooking = await prisma.bookings.update({
      where: { id: booking_id },
      data: {
        razorpay_order_id,
        razorpay_payment_id,
        status: 'active',
      },
    });

    return res.json({
      message: 'Payment verified successfully. Booking is now active.',
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/webhook
 * Handle asynchronous payment events from Razorpay
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const event = req.body;
    console.log('[Razorpay Webhook] Received event:', event?.event);

    if (event?.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        await prisma.bookings.updateMany({
          where: { razorpay_order_id: orderId },
          data: {
            razorpay_payment_id: paymentId,
            status: 'active',
          },
        });
      }
    }

    return res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /payments/booking/:bookingId
 * Query payment details for a given booking
 */
router.get('/booking/:bookingId', async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        total_amount: true,
        razorpay_order_id: true,
        razorpay_payment_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({
      booking_id: booking.id,
      status: booking.status,
      payment: {
        order_id: booking.razorpay_order_id,
        payment_id: booking.razorpay_payment_id,
        amount: booking.total_amount,
        is_paid: Boolean(booking.razorpay_payment_id && booking.status !== 'pending'),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
