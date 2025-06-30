import Redis, { RedisOptions } from 'ioredis';

const redisOptions: RedisOptions = {
  port: 6379,
  host: 'localhost',
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  connectTimeout: 5000,
  enableOfflineQueue: false
};

const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : new Redis(redisOptions);

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
