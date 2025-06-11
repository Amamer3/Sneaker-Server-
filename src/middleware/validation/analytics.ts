import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TimeFrame, Granularity } from '../../types/analytics';

const timeFrameSchema = z.enum(['hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const);
const granularitySchema = z.enum(['hour', 'day', 'week', 'month'] as const);

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .transform((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date;
  });

// Helper function to check granularity against timeframe
const isValidGranularity = (granularity: Granularity | undefined, timeframe: TimeFrame): boolean => {
  if (!granularity) return true;
  const granularityRank: Record<Granularity, number> = { hour: 0, day: 1, week: 2, month: 3 };
  const timeframeRank: Record<TimeFrame, number> = { 
    hourly: 0, daily: 1, weekly: 2, monthly: 3, quarterly: 4, yearly: 5 
  };
  return granularityRank[granularity] <= timeframeRank[timeframe];
};

// Schema for analytics query parameters
const analyticsQuerySchema = z.object({
  limit: z.string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '10', 10);
      return num > 0 && num <= 100 ? num : 10;
    }),
  timeframe: timeFrameSchema
    .optional()
    .default('monthly'),
  granularity: granularitySchema
    .optional(),
  startDate: dateSchema
    .optional()
    .refine((date) => !date || date <= new Date(), 'Start date cannot be in the future'),
  endDate: dateSchema
    .optional()
    .refine((date) => !date || date <= new Date(), 'End date cannot be in the future'),
  includeTotal: z.string()
    .optional()
    .transform(val => val === 'true'),
  compareWithPrevious: z.string()
    .optional()
    .transform(val => val === 'true')
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return data.startDate <= data.endDate;
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['startDate']
  }
).refine(
  (data) => isValidGranularity(data.granularity, data.timeframe),
  {
    message: 'Granularity must be finer than timeframe',
    path: ['granularity']
  }
);

export interface ValidatedAnalyticsQuery {
  limit?: number;
  timeframe?: TimeFrame;
  granularity?: Granularity;
  startDate?: Date;
  endDate?: Date;
  includeTotal?: boolean;
  compareWithPrevious?: boolean;
}

export const validateAnalyticsQuery = (
  req: Request & { analyticsQuery?: ValidatedAnalyticsQuery },
  res: Response,
  next: NextFunction
) => {
  try {
    const result = analyticsQuerySchema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.errors
      });
      return;
    }    // Convert dates to strings and ensure all values are strings
    const queryParams: Record<string, string> = {};
    
    Object.entries(result.data).forEach(([key, value]) => {
      if (value instanceof Date) {
        queryParams[key] = value.toISOString().split('T')[0];
      } else if (value !== undefined) {
        queryParams[key] = String(value);
      }
    });

    // Update query params with string values
    req.query = queryParams;
    
    // Store validated data in a custom property
    req.analyticsQuery = result.data;
    next();
  } catch (error) {
    next(error);
  }
};
