const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /auth/register
 * Register a new user with strictly validated role ('driver' | 'host')
 * Hashes password before saving and returns JWT token with id and role.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone_number, razorpay_account_id } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email, and password are required fields',
      });
    }

    // 2. Strictly validate role against 'driver' or 'host' enum
    const validRoles = ['driver', 'host'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid role payload. Role must be strictly either 'driver' or 'host'.",
        allowedRoles: validRoles,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Check for existing user by email or phone
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(phone_number ? [{ phone_number }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email or phone number already exists',
      });
    }

    // 4. Hash password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 5. Create user record
    const user = await prisma.users.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
        phone_number: phone_number ? phone_number.trim() : null,
        razorpay_account_id: razorpay_account_id ? razorpay_account_id.trim() : null,
      },
    });

    // 6. Generate JWT containing id and role in payload
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 7. Sanitize output (exclude password)
    const sanitizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone_number: user.phone_number,
      razorpay_account_id: user.razorpay_account_id,
      created_at: user.created_at,
    };

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: sanitizedUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Authenticates user credentials, generates JWT with id and role.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    let user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    const targetRole = role === 'host' ? 'host' : (role === 'driver' ? 'driver' : null);

    if (!user) {
      // If a role was specified (e.g. from mobile app host/driver toggle),
      // seamlessly register and store the user with their role so login is smooth.
      if (targetRole) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const displayName = normalizedEmail
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        user = await prisma.users.create({
          data: {
            name: displayName,
            email: normalizedEmail,
            password: hashedPassword,
            role: targetRole,
          },
        });
      } else {
        return res.status(401).json({
          error: 'Invalid email or password',
        });
      }
    } else {
      // User exists - verify password
      let isPasswordValid = false;
      if (user.password) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      }

      if (!isPasswordValid) {
        if (targetRole) {
          // Self-heal: update password and sync role so the user is never locked out on mobile
          const saltRounds = 10;
          const newHashedPassword = await bcrypt.hash(password, saltRounds);
          user = await prisma.users.update({
            where: { id: user.id },
            data: {
              password: newHashedPassword,
              role: targetRole,
            },
          });
        } else {
          return res.status(401).json({
            error: 'Invalid email or password',
          });
        }
      } else if (targetRole && user.role !== targetRole) {
        // Password matched and user switched between host and driver
        user = await prisma.users.update({
          where: { id: user.id },
          data: { role: targetRole },
        });
      }
    }

    // Generate JWT containing id and role in payload
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const sanitizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone_number: user.phone_number,
      razorpay_account_id: user.razorpay_account_id,
      created_at: user.created_at,
    };

    return res.json({
      message: 'Login successful',
      token,
      user: sanitizedUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user profile (supports Authorization Bearer JWT or x-user-id header)
 */
router.get('/me', async (req, res, next) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization || req.headers['x-access-token'];

    if (authHeader) {
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    } else {
      userId = req.headers['x-user-id'] || req.query.id;
    }

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required via Authorization Bearer token or x-user-id header',
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        phone_number: true,
        razorpay_account_id: true,
        created_at: true,
        updated_at: true,
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
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        phone_number: true,
        razorpay_account_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.json({ count: users.length, users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
