import { Redis } from 'ioredis';
import redis from '../config/redis';
import logger from './logger';

const CACHE_TTL = 60 * 5; // 5 minutes

// In-memory cache as fallback when Redis is disabled
const memoryCache = new Map<string, { data: any; expires: number }>();

export const cacheKey = (prefix: string, params: Record<string, any>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);
  
  return `${prefix}:${JSON.stringify(sortedParams)}`;
};

export const getCache = async <T = any>(key: string): Promise<T | null> => {
  try {
    // Try Redis first
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    // Fallback to memory cache
    try {
      const cached = memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
      
      // Clean up expired entry
      if (cached) {
        memoryCache.delete(key);
      }
      
      return null;
    } catch (memError) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }
};

export const setCache = async (
  key: string,
  data: any,
  ttl: number = CACHE_TTL
): Promise<boolean> => {
  try {
    // Try Redis first
    await redis.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (error) {
    // Fallback to memory cache
    try {
      const expires = Date.now() + (ttl * 1000);
      memoryCache.set(key, { data, expires });
      return true;
    } catch (memError) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
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
