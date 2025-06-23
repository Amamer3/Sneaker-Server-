import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateRequest = (schema: AnyZodObject) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
      return;
    }
    res.status(500).json({ message: 'Internal validation error' });
    return;
  }
};

export const validateQuery = (schema: AnyZodObject) => async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await schema.parseAsync(req.query);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }
    return res.status(500).json({ message: 'Internal validation error' });
  }
};
