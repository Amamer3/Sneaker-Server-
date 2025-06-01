import redis from '../config/redis';

const CACHE_TTL = 60 * 5; // 5 minutes

export const cacheKey = (prefix: string, params: Record<string, any>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);
  
  return `${prefix}:${JSON.stringify(sortedParams)}`;
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

export const setCache = async (key: string, data: any): Promise<void> => {
  await redis.setex(key, CACHE_TTL, JSON.stringify(data));
};

export const clearCache = async (pattern: string): Promise<void> => {
  const keys = await redis.keys(pattern);
  if (keys.length) {
    await redis.del(keys);
  }
};
