import { Router } from 'express';
import { authorizeRoles } from '../middleware/auth';
import { validateAnalyticsQuery } from '../middleware/validation/analytics';
import { analyticsRateLimit } from '../middleware/rateLimit';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

// Apply middleware to all analytics routes
router.use(authorizeRoles('admin'));
router.use(analyticsRateLimit);
router.use(validateAnalyticsQuery);

// Overview Analytics
router.get('/overview', analyticsController.getOverviewStats);

// Revenue Analytics
router.get('/revenue', analyticsController.getRevenueStats);

// Order Analytics
router.get('/orders', analyticsController.getOrderStats);

// Product Analytics
router.get('/products', analyticsController.getProductStats);
router.get('/products/top-selling', analyticsController.getTopSellingProducts);
router.get('/products/low-stock', analyticsController.getLowStockProducts);
router.get('/products/by-category', analyticsController.getProductsByCategory);

// Customer Analytics
router.get('/customers', analyticsController.getCustomerStats);

export default router;
