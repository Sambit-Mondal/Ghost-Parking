const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');

// UUID v4 format validator for PostgreSQL @db.Uuid columns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val) => typeof val === 'string' && UUID_REGEX.test(val);

/**
 * GET /host/earnings
 * Protected endpoint returning the authenticated Host's aggregated net earnings
 * (sum of booking amounts * 0.80) and recent transaction history for active and completed bookings.
 */
router.get('/earnings', verifyToken, async (req, res, next) => {
  try {
    const hostId = req.user?.id;

    if (!hostId || !isUuid(hostId)) {
      return res.status(400).json({ error: 'Valid host user ID is required from authentication token' });
    }

    // Query all bookings for spots owned by the logged-in host with status in ['completed', 'active']
    const bookings = await prisma.bookings.findMany({
      where: {
        spot: {
          host_id: hostId,
        },
        status: {
          in: ['active', 'completed'],
        },
      },
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            address: true,
            hourly_rate: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    let totalGrossPaise = 0;
    let totalNetPaise = 0;
    let totalPlatformPaise = 0;
    let activeCount = 0;
    let completedCount = 0;

    const recentTransactions = bookings.map((b) => {
      const grossPaise = Math.round(Number(b.total_amount) * 100);
      const hostNetPaise = Math.round(grossPaise * 0.80);
      const platformFeePaise = grossPaise - hostNetPaise;

      totalGrossPaise += grossPaise;
      totalNetPaise += hostNetPaise;
      totalPlatformPaise += platformFeePaise;

      if (b.status === 'active') activeCount++;
      if (b.status === 'completed') completedCount++;

      return {
        id: b.id,
        booking_id: b.id,
        spot_id: b.spot_id,
        spot_title: b.spot?.title || 'Parking Space',
        spot_address: b.spot?.address || '',
        driver_name: b.driver?.name || 'Verified Driver',
        driver_email: b.driver?.email || '',
        gross_amount: grossPaise / 100,
        host_net_earnings: hostNetPaise / 100,
        platform_fee: platformFeePaise / 100,
        status: b.status,
        razorpay_order_id: b.razorpay_order_id,
        razorpay_payment_id: b.razorpay_payment_id,
        start_time: b.start_time,
        end_time: b.end_time,
        created_at: b.created_at,
      };
    });

    const totalGross = totalGrossPaise / 100;
    const totalNet = totalNetPaise / 100;
    const totalPlatform = totalPlatformPaise / 100;

    return res.json({
      success: true,
      host_id: hostId,
      total_net_earnings: totalNet,
      total_gross_earnings: totalGross,
      platform_fee_deducted: totalPlatform,
      active_bookings_count: activeCount,
      completed_bookings_count: completedCount,
      total_qualifying_bookings: bookings.length,
      split_rule: {
        host_percentage: 80,
        platform_fee_percentage: 20,
      },
      recent_transactions: recentTransactions,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

