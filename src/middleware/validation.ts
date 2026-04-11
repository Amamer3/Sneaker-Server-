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
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isLength({ max: 254 })
    .withMessage('Email is too long')
    .isEmail()
    .withMessage('Valid email required')
    .custom((value: string) => {
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
        throw new Error('Invalid email');
      }
      return true;
    }),
];

/** Email verification via JWT from transactional email link. */
export const verifyEmailTokenValidation: ValidationChain[] = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 20, max: 4096 })
    .withMessage('Invalid verification token'),
];

/** Completing reset via JWT link (not Firebase oob flow). */
export const resetPasswordWithTokenValidation: ValidationChain[] = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 20, max: 4096 })
    .withMessage('Invalid reset token'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 })
    .withMessage('Password too long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
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
