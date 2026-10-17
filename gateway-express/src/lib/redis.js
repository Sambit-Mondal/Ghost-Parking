const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      // Don't keep hammering if redis is down locally
      return null;
    }
    return Math.min(times * 100, 2000);
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection warning/error:', err.message);
});

module.exports = redis;
