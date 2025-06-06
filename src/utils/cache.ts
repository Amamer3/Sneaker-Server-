import { Redis } from 'ioredis';
import redis from '../config/redis';
import logger from './logger';

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
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Cache get error for key ${key}:`, error);
    return null;
  }
};

export const setCache = async (
  key: string,
  data: any,
  ttl: number = CACHE_TTL
): Promise<boolean> => {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error(`Cache set error for key ${key}:`, error);
    return false;
  }
};

export const clearCache = async (pattern: string): Promise<boolean> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) {
      await redis.del(keys);
    }
    return true;
  } catch (error) {
    logger.error(`Cache clear error for pattern ${pattern}:`, error);
    return false;
  }
};
