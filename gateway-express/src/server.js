require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRouter = require('./routes/auth');
const bookingsRouter = require('./routes/bookings');
const paymentsRouter = require('./routes/payments');
const spotsRouter = require('./routes/spots');
const prisma = require('./lib/prisma');
const redis = require('./lib/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.ping();
    } else {
      redisStatus = `status: ${redis.status}`;
    }
  } catch (err) {
    redisStatus = `unhealthy: ${err.message}`;
  }

  const isHealthy = dbStatus === 'ok';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'gateway-express',
    timestamp: new Date().toISOString(),
    postgres: dbStatus,
    redis: redisStatus,
  });
});

// Mount Routes (supporting direct and /api/v1 prefixes)
app.use('/auth', authRouter);
app.use('/api/v1/auth', authRouter);

app.use('/bookings', bookingsRouter);
app.use('/api/v1/bookings', bookingsRouter);

app.use('/payments', paymentsRouter);
app.use('/api/v1/payments', paymentsRouter);

app.use('/spots', spotsRouter);
app.use('/api/v1/spots', spotsRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Ghost Parking API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: ['/auth/register', '/auth/login', '/auth/me', '/auth/users'],
      bookings: ['/bookings (POST, GET)', '/bookings/:id', '/bookings/:id/status (PATCH)', '/bookings/:id/cancel (POST)'],
      payments: ['/payments/order (POST)', '/payments/verify (POST)', '/payments/webhook (POST)', '/payments/booking/:id (GET)'],
      spots: ['/spots (POST, GET)'],
    },
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Conflict: Unique constraint violated on ' + (err.meta?.target || 'field'),
    });
  }

  // Prisma foreign key constraint violation
  if (err.code === 'P2003') {
    return res.status(400).json({
      error: 'Foreign key constraint failed on ' + (err.meta?.field_name || 'relation'),
    });
  }

  return res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Express Gateway] Server running on port ${PORT}`);
  });
}

module.exports = app;
