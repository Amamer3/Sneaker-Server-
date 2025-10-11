import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Sanitize input to prevent XSS
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj.trim());
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Validate and sanitize common parameters
export const validateCommonParams: ValidationChain[] = [
  param('id').isLength({ min: 1, max: 100 }).withMessage('Invalid ID format'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

// Validate email format
export const validateEmail: ValidationChain[] = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .isLength({ max: 100 }).withMessage('Email too long')
    .normalizeEmail(),
];

// Validate password strength
export const validatePassword: ValidationChain[] = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 }).withMessage('Password too long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

// Validate product data
export const validateProduct: ValidationChain[] = [
  body('name').isLength({ min: 1, max: 200 }).withMessage('Product name must be between 1 and 200 characters'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description too long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('category').isLength({ min: 1, max: 100 }).withMessage('Category must be between 1 and 100 characters'),
  body('brand').isLength({ min: 1, max: 100 }).withMessage('Brand must be between 1 and 100 characters'),
];

// Validate order data
export const validateOrder: ValidationChain[] = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.productId').isLength({ min: 1, max: 100 }).withMessage('Invalid product ID'),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100'),
  body('shippingAddress.street').isLength({ min: 1, max: 200 }).withMessage('Street address required'),
  body('shippingAddress.city').isLength({ min: 1, max: 100 }).withMessage('City required'),
  body('shippingAddress.state').isLength({ min: 1, max: 100 }).withMessage('State required'),
  body('shippingAddress.country').isLength({ min: 1, max: 100 }).withMessage('Country required'),
  body('shippingAddress.postalCode').isLength({ min: 1, max: 20 }).withMessage('Postal code required'),
  body('shippingAddress.phone').isLength({ min: 1, max: 20 }).withMessage('Phone number required'),
];

// Generic validation handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  next();
};

// Rate limiting for validation failures
export const rateLimitValidationFailures = (req: Request, res: Response, next: NextFunction): void => {
  // This would integrate with your rate limiting system
  // For now, just pass through
  next();
};




