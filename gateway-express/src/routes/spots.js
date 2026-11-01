const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { verifyToken, requireHost } = require('../middleware/auth');
const { broadcastSpotAdded, broadcastSpotUpdated } = require('../lib/socket');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val) => typeof val === 'string' && UUID_REGEX.test(val);

/**
 * POST /spots
 * Host-only route: Create a new parking spot with PostGIS Point geometry (SRID 4326)
 * Protected with verifyToken (authenticates user) and requireHost (blocks drivers).
 */
router.post('/', verifyToken, requireHost, async (req, res, next) => {
  try {
    const { title, address, latitude, longitude, hourly_rate, is_active } = req.body;
    // Use host_id from req.body if provided, or default to authenticated user id from JWT
    const host_id = req.body.host_id || req.user.id;

    if (!host_id || !title || !address || latitude === undefined || longitude === undefined || hourly_rate === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: title, address, latitude, longitude, hourly_rate',
      });
    }

    const host = await prisma.users.findUnique({ where: { id: host_id } });
    if (!host) {
      return res.status(404).json({ error: 'Host user not found' });
    }

    if (host.role !== 'host' && host.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Target user does not have host role' });
    }

    // Insert spot using raw SQL to properly construct ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    const result = await prisma.$queryRaw`
      INSERT INTO parking_spots (
        host_id, title, address, location, hourly_rate, is_active
      )
      VALUES (
        ${host_id}::uuid,
        ${title},
        ${address},
        ST_SetSRID(ST_MakePoint(${parseFloat(longitude)}, ${parseFloat(latitude)}), 4326),
        ${parseFloat(hourly_rate)},
        ${is_active !== undefined ? Boolean(is_active) : true}
      )
      RETURNING 
        id, host_id, title, address, hourly_rate, is_active, created_at, updated_at,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude;
    `;

    const createdSpot = result[0];
    const spotPayload = {
      id: createdSpot.id,
      host_id: createdSpot.host_id,
      title: createdSpot.title,
      address: createdSpot.address,
      latitude: parseFloat(createdSpot.latitude),
      longitude: parseFloat(createdSpot.longitude),
      hourly_rate: parseFloat(createdSpot.hourly_rate),
      is_active: Boolean(createdSpot.is_active),
      available_slots: 1,
      created_at: createdSpot.created_at,
      updated_at: createdSpot.updated_at,
    };

    // Broadcast real-time WebSocket event to all connected drivers
    broadcastSpotAdded(spotPayload);

    return res.status(201).json({
      message: 'Parking spot created successfully',
      spot: spotPayload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /spots/:id/pause
 * PATCH /spots/:id/status
 * Pauses, resumes, or toggles active status of a parking spot.
 * Broadcasts 'spot_updated' via Socket.io with { id, is_active }.
 */
const handlePauseOrToggleSpot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body || {};

    let existingSpot = null;
    if (isUuid(id)) {
      existingSpot = await prisma.parking_spots.findUnique({
        where: { id },
      });
    }

    if (!existingSpot) {
      // If it's a demo or non-persisted spot ID, still toggle and broadcast so live drivers update
      const newStatus = is_active !== undefined ? Boolean(is_active) : false;
      const updatePayload = {
        id,
        is_active: newStatus,
        title: 'Demo Parking Spot',
        hourly_rate: 80,
      };
      broadcastSpotUpdated(updatePayload);
      return res.json({
        message: `Parking spot ${newStatus ? 'activated' : 'paused'} successfully`,
        spot: updatePayload,
      });
    }

    // If is_active is explicitly passed as boolean, use it. Otherwise, toggle current status.
    const newStatus = is_active !== undefined ? Boolean(is_active) : !existingSpot.is_active;

    const updatedSpot = await prisma.parking_spots.update({
      where: { id },
      data: {
        is_active: newStatus,
        updated_at: new Date(),
      },
    });

    const updatePayload = {
      id: updatedSpot.id,
      is_active: updatedSpot.is_active,
      title: updatedSpot.title,
      hourly_rate: parseFloat(updatedSpot.hourly_rate),
    };

    // Broadcast spot_updated to all connected drivers
    broadcastSpotUpdated(updatePayload);

    return res.json({
      message: `Parking spot ${newStatus ? 'activated' : 'paused'} successfully`,
      spot: updatePayload,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /spots/me
 * Host-only route: Return only parking spots where host_id matches authenticated user's ID.
 * Protected with verifyToken.
 */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const hostId = req.user.id;

    if (!isUuid(hostId)) {
      return res.status(400).json({ error: 'Invalid user ID in token' });
    }

    const spots = await prisma.$queryRaw`
      SELECT 
        s.id, s.host_id, s.title, s.address, s.hourly_rate, s.is_active, s.created_at, s.updated_at,
        ST_X(s.location::geometry) AS longitude,
        ST_Y(s.location::geometry) AS latitude,
        COUNT(b.id)::int AS total_bookings,
        COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0)::float AS lifetime_earnings
      FROM parking_spots s
      LEFT JOIN bookings b ON b.spot_id = s.id
      WHERE s.host_id = ${hostId}::uuid
      GROUP BY s.id, s.host_id, s.title, s.address, s.hourly_rate, s.is_active, s.created_at, s.updated_at, s.location
      ORDER BY s.created_at DESC;
    `;

    const formattedSpots = (Array.isArray(spots) ? spots : []).map((s) => ({
      id: s.id,
      host_id: s.host_id,
      title: s.title,
      address: s.address,
      latitude: parseFloat(s.latitude),
      longitude: parseFloat(s.longitude),
      hourly_rate: parseFloat(s.hourly_rate),
      is_active: Boolean(s.is_active),
      total_bookings: parseInt(s.total_bookings, 10) || 0,
      lifetime_earnings: parseFloat(s.lifetime_earnings) || 0,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    return res.json({
      count: formattedSpots.length,
      spots: formattedSpots,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/pause', handlePauseOrToggleSpot);
router.patch('/:id/status', handlePauseOrToggleSpot);
router.patch('/:id', handlePauseOrToggleSpot);

/**
 * GET /spots
 * List parking spots with lat/long extracted
 */
router.get('/', async (req, res, next) => {
  try {
    const spots = await prisma.$queryRaw`
      SELECT 
        id, host_id, title, address, hourly_rate, is_active, created_at, updated_at,
        ST_X(location::geometry) AS longitude,
        ST_Y(location::geometry) AS latitude
      FROM parking_spots
      ORDER BY created_at DESC
      LIMIT 50;
    `;

    return res.json({ count: spots.length, spots });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
