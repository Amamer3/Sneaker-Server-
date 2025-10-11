import { body, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const registerValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Valid email required').isLength({ max: 100 }).withMessage('Email too long'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 }).withMessage('Password too long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('name').notEmpty().withMessage('Name required').isLength({ max: 100 }).withMessage('Name too long'),
];

export const loginValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

export const forgotPasswordValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Valid email required'),
];

export const resetPasswordValidation: ValidationChain[] = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 }).withMessage('Password too long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

// Adjust `validate` middleware to ensure compatibility with `RequestHandler`
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
}
