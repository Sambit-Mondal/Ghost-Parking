const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { verifyToken, requireHost } = require('../middleware/auth');

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

    return res.status(201).json({
      message: 'Parking spot created successfully',
      spot: result[0],
    });
  } catch (error) {
    next(error);
  }
});

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
