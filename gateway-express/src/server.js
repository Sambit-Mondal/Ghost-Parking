require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRouter = require('./routes/auth');
const bookingsRouter = require('./routes/bookings');
const paymentsRouter = require('./routes/payments');
const spotsRouter = require('./routes/spots');
const spotsProxy = require('./proxy/spotsProxy');
const prisma = require('./lib/prisma');
const redis = require('./lib/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Robust CORS configuration supporting mobile apps, dev servers, and web clients
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-client',
    'x-gateway-source',
    'x-forwarded-host',
    'x-forwarded-for',
    'x-forwarded-proto',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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

// Internal HTTP Proxy: Securely forward /api/spots mobile requests to Go Search Engine
app.use('/api/spots', spotsProxy);

app.use('/spots', spotsRouter);
app.use('/api/v1/spots', spotsRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Ghost Parking API Gateway',
    version: '1.1.0',
    endpoints: {
      health: '/health',
      auth: ['/auth/register', '/auth/login', '/auth/me', '/auth/users'],
      bookings: ['/bookings (POST, GET)', '/bookings/:id', '/bookings/:id/status (PATCH)', '/bookings/:id/cancel (POST)', '/bookings/check-in (POST)'],
      payments: [
        '/payments/pre-authorize (POST)',
        '/payments/verify (POST)',
        '/payments/checkout (POST)',
        '/payments/webhook (POST)',
        '/payments/booking/:id (GET)',
      ],
      spots_admin: ['/spots (POST, GET)'],
      spots_search_proxy: ['/api/spots (GET)', '/api/spots/nearby (GET) -> forwards to Go service'],
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

const http = require('http');
const { initSocket } = require('./lib/socket');

const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);
app.set('server', server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Express Gateway] Server running with WebSocket on port ${PORT}`);
  });
}

module.exports = app;
module.exports.server = server;
