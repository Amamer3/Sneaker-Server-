import { Router, Request, Response } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import { analyticsRateLimit } from '../middleware/rateLimit';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

// Apply middleware to all analytics routes
router.use(authenticateJWT);
router.use(authorizeRoles('admin'));
router.use(analyticsRateLimit);

// Async wrapper function
const asyncHandler = (fn: Function) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error('Route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
};

// Overview Analytics
router.get('/overview', asyncHandler(analyticsController.getOverviewStats));

// Revenue Analytics
router.get('/revenue', asyncHandler(analyticsController.getRevenueStats));

// Order Analytics
router.get('/orders', asyncHandler(analyticsController.getOrderStats));

// Product Analytics
router.get('/products', asyncHandler(analyticsController.getProductStats));
router.get('/products/by-category', asyncHandler(analyticsController.getProductsByCategory));
router.get('/products/top-selling', asyncHandler(analyticsController.getTopSellingProducts));
router.get('/products/low-stock', asyncHandler(analyticsController.getLowStockProducts));

// Customer Analytics
router.get('/customers', asyncHandler(analyticsController.getCustomerStats));

export default router;
