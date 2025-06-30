import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeInput = [
  body('*').customSanitizer((value) => {
    if (typeof value === 'string') {
      return DOMPurify.sanitize(value.trim());
    }
    return value;
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];