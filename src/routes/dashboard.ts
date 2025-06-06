import { Router } from 'express';
import { authorizeRoles } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';
import { analyticsRateLimit } from '../middleware/rateLimit';
import { cacheControl } from '../middleware/cache-control';

const router = Router();

// Apply middleware to all dashboard routes
router.use(authorizeRoles('admin'));
router.use(analyticsRateLimit);

// Cache control settings
const CACHE_SETTINGS = {
  maxAge: 300, // 5 minutes
  staleWhileRevalidate: 60 // 1 minute
};

// Dashboard routes
router.get('/stats', 
  cacheControl(CACHE_SETTINGS),
  dashboardController.getDashboardStats
);

router.get('/recent-orders', 
  cacheControl(CACHE_SETTINGS),
  dashboardController.getRecentOrders
);

export default router;
