import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  connectTimeout: 5000
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.warn('Redis connection error (continuing without Redis):', err.message);
});

redis.on('close', () => {
  console.warn('Redis connection closed');
});

export default redis;
