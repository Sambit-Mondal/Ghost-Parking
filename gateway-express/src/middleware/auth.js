const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ghost-parking-secret-key-change-in-prod';

/**
 * verifyToken
 * Authenticates the user by verifying the JWT in the Authorization header.
 * Attaches the decoded payload ({ id, role, ... }) to req.user.
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-access-token'];

    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied. No authentication token provided.',
      });
    }

    // Support 'Bearer <token>' or raw token
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. Token is empty.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired. Please log in again.',
      });
    }
    return res.status(401).json({
      error: 'Invalid token.',
    });
  }
};

/**
 * requireHost
 * Authorization middleware blocking drivers and unauthenticated users from host-only routes.
 * Must be preceded by verifyToken.
 */
const requireHost = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  if (req.user.role !== 'host' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: "Access denied. Host role required. Drivers cannot access host endpoints.",
    });
  }

  next();
};

/**
 * requireDriver
 * Authorization middleware requiring driver or admin role.
 */
const requireDriver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  if (req.user.role !== 'driver' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Driver role required.',
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireHost,
  requireDriver,
  JWT_SECRET,
};

