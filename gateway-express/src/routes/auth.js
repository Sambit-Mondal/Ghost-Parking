const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

/**
 * POST /auth/register
 * Register a new user (role: 'driver' | 'host' | 'admin')
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone_number, role, razorpay_account_id } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required fields' });
    }

    const validRoles = ['driver', 'host', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }

    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { email },
          ...(phone_number ? [{ phone_number }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email or phone number already exists' });
    }

    const user = await prisma.users.create({
      data: {
        name,
        email,
        phone_number: phone_number || null,
        role: role || 'driver',
        razorpay_account_id: razorpay_account_id || null,
      },
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Simple login / session lookup by email
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      message: 'Login successful',
      user,
      token: `dummy-token-${user.id}`, // Placeholder JWT/session token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user profile by user id (header x-user-id or query param)
 */
router.get('/me', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required via x-user-id header or id query param' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        bookings: {
          take: 5,
          orderBy: { created_at: 'desc' },
        },
        parking_spots: {
          take: 5,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/users
 * List all users with optional ?role= filter
 */
router.get('/users', async (req, res, next) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) {
      where.role = role;
    }

    const users = await prisma.users.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.json({ count: users.length, users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
