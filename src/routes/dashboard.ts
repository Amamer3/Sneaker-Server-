import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';
import { analyticsRateLimit } from '../middleware/rateLimit';
import { cacheControl } from '../middleware/cache-control';

const router = Router();

// Apply middleware to all dashboard routes
router.use(authenticateJWT); // First check if the user is authenticated
router.use(authorizeRoles('admin')); // Then check if they are an admin
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
