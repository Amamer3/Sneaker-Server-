import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getCache, setCache } from '../utils/cache';
import { logSecureWarn } from '../utils/secureLogger';

// IP-based rate limiting with Redis storage
const createEnhancedRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    // Use default memory store for now - Redis integration can be added later
    // store: customRedisStore,
    handler: (req: Request, res: Response) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      logSecureWarn('Rate limit exceeded', {
        ip,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
export const authRateLimit = createEnhancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts. Please try again later.',
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => `auth:${req.ip}`
});

export const apiRateLimit = createEnhancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many API requests. Please try again later.',
  keyGenerator: (req: Request) => `api:${req.ip}`
});

export const uploadRateLimit = createEnhancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: 'Too many file uploads. Please try again later.',
  keyGenerator: (req: Request) => `upload:${req.ip}`
});

export const adminRateLimit = createEnhancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many admin requests. Please try again later.',
  keyGenerator: (req: Request) => `admin:${req.ip}`
});

// Strict rate limit for sensitive operations
export const strictRateLimit = createEnhancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many attempts. Please try again later.',
  keyGenerator: (req: Request) => `strict:${req.ip}`
});

// WebSocket connection rate limit
export const websocketRateLimit = createEnhancedRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 connections per 5 minutes
  message: 'Too many WebSocket connections. Please try again later.',
  keyGenerator: (req: Request) => `ws:${req.ip}`
});

// IP-based blocking for repeated violations
export const checkIPBlocked = async (ip: string): Promise<boolean> => {
  try {
    const blocked = await getCache(`blocked:${ip}`);
    return !!blocked;
  } catch (error) {
    return false;
  }
};

export const blockIP = async (ip: string, duration: number = 24 * 60 * 60): Promise<void> => {
  try {
    await setCache(`blocked:${ip}`, true, duration);
    logSecureWarn('IP blocked due to repeated violations', { ip, duration });
  } catch (error) {
    logSecureWarn('Failed to block IP', { ip, error });
  }
};

// Middleware to check if IP is blocked
export const checkBlockedIP = (req: Request, res: Response, next: Function) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  checkIPBlocked(ip).then(blocked => {
    if (blocked) {
      res.status(403).json({
        error: 'IP blocked',
        message: 'Your IP has been temporarily blocked due to suspicious activity.'
      });
    } else {
      next();
    }
  }).catch(() => {
    // Fail open - allow request if check fails
    next();
  });
};
