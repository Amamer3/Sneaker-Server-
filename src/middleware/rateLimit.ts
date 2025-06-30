import rateLimit from 'express-rate-limit';

// Create a memory-based rate limiter for analytics endpoints
export const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many analytics requests. Please try again later.',
  },
  // Configure IP extraction when behind a proxy
  keyGenerator: (req) => {
    // Get IP from X-Forwarded-For when behind proxy
    const ip = req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.socket.remoteAddress || 
               'unknown';
    return `analytics-${ip}`;
  },
  skip: (req) => false, // Don't skip any requests
  requestWasSuccessful: (req) => true, // Count all requests towards limit
});
