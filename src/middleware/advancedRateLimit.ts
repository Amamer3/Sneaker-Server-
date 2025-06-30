import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `${req.ip}:${req.route?.path || req.path}`,
  });
};

// Different limits for different endpoints
export const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
export const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 });