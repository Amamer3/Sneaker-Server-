import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const timeFrameSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

const commonQueries = {
  limit: z.string().optional().transform(val => {
    const num = parseInt(val || '10', 10);
    return num > 0 && num <= 100 ? num : 10;
  }),
  timeframe: timeFrameSchema.optional().default('monthly'),
};

export const validateAnalyticsQuery = (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      query: z.object(commonQueries),
    });

    const result = schema.parse({
      query: req.query,
    });

    req.query = Object.fromEntries(
      Object.entries(result.query).map(([key, value]) => [key, String(value)])
    );
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }
    next(error);
  }
};
