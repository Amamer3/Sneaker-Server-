import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import logger from 'utils/logger';

export const optimizationMiddleware = [
  compression({
    filter: (req: { headers: { [x: string]: any; }; }, res: any) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req as Request, res);
    },
    level: 6,
    threshold: 1024
  }),
  
  // Response time tracking
  (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn(`Slow response: ${req.method} ${req.path} - ${duration}ms`);
      }
    });
    next();
  }
];