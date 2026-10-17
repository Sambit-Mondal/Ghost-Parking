const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

const VALID_STATUSES = ['pending', 'active', 'completed', 'cancelled', 'disputed'];

/**
 * POST /bookings
 * Create a new booking
 */
router.post('/', async (req, res, next) => {
  try {
    const { driver_id, spot_id, start_time, end_time, total_amount } = req.body;

    if (!driver_id || !spot_id || !start_time || !end_time || total_amount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: driver_id, spot_id, start_time, end_time, total_amount',
      });
    }

    // Verify driver exists
    const driver = await prisma.users.findUnique({
      where: { id: driver_id },
    });
    if (!driver) {
      return res.status(404).json({ error: 'Driver user not found' });
    }

    // Verify parking spot exists
    const spot = await prisma.parking_spots.findUnique({
      where: { id: spot_id },
    });
    if (!spot) {
      return res.status(404).json({ error: 'Parking spot not found' });
    }

    const startTimeDate = new Date(start_time);
    const endTimeDate = new Date(end_time);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      return res.status(400).json({ error: 'Invalid start_time or end_time format' });
    }

    if (startTimeDate >= endTimeDate) {
      return res.status(400).json({ error: 'start_time must be before end_time' });
    }

    const booking = await prisma.bookings.create({
      data: {
        driver_id,
        spot_id,
        start_time: startTimeDate,
        end_time: endTimeDate,
        total_amount: parseFloat(total_amount),
        status: 'pending',
      },
      include: {
        driver: {
          select: { id: true, name: true, email: true, phone_number: true },
        },
        spot: {
          select: { id: true, title: true, address: true, hourly_rate: true },
        },
      },
    });

    return res.status(201).json({
      message: 'Booking created successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /bookings
 * List bookings with optional query filters: driver_id, spot_id, status
 */
router.get('/', async (req, res, next) => {
  try {
    const { driver_id, spot_id, status, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (driver_id) where.driver_id = driver_id;
    if (spot_id) where.spot_id = spot_id;
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });
      }
      where.status = status;
    }

    const bookings = await prisma.bookings.findMany({
      where,
      include: {
        driver: {
          select: { id: true, name: true, email: true },
        },
        spot: {
          select: { id: true, title: true, address: true, hourly_rate: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    });

    const total = await prisma.bookings.count({ where });

    return res.json({
      total,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /bookings/:id
 * Get single booking by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: {
        driver: {
          select: { id: true, name: true, email: true, phone_number: true },
        },
        spot: {
          select: { id: true, title: true, address: true, hourly_rate: true, host_id: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({ booking });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /bookings/:id/status
 * Update booking status ('pending', 'active', 'completed', 'cancelled', 'disputed')
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const updatedBooking = await prisma.bookings.update({
      where: { id },
      data: { status },
    });

    return res.json({
      message: `Booking status updated to ${status}`,
      booking: updatedBooking,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Booking not found' });
    }
    next(error);
  }
});

/**
 * POST /bookings/:id/cancel
 * Cancel a booking
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await prisma.bookings.findUnique({ where: { id } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel a booking that is already ${booking.status}` });
    }

    const cancelledBooking = await prisma.bookings.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return res.json({
      message: 'Booking cancelled successfully',
      booking: cancelledBooking,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
