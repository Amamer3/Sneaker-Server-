import { Router, RequestHandler, Response } from 'express';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';
import * as couponController from '../controllers/couponController';

const router = Router();

// Helper function to handle async routes
const wrapHandler = (handler: (req: AuthRequest, res: Response) => Promise<any>): RequestHandler => 
  (req, res, next) => handler(req as AuthRequest, res).catch(next);

// Admin routes - all require authentication and admin role
router.use(authenticateJWT);
router.use(authorizeRoles('admin'));

// Get all coupons (admin)
router.get('/', wrapHandler(couponController.getAllCoupons));

// Get coupon stats (admin)
router.get('/stats', wrapHandler(couponController.getCouponStats));

// Create new coupon (admin)
router.post('/', wrapHandler(couponController.createCoupon));

// Update coupon (admin)
router.put('/:id', wrapHandler(couponController.updateCoupon));

// Delete coupon (admin)
router.delete('/:id', wrapHandler(couponController.deleteCoupon));

// Validate coupon (can be used by both admin and customers)
router.post('/validate', wrapHandler(couponController.validateCoupon));

export default router;
