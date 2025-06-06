import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import { validateAnalyticsQuery } from '../middleware/validation/analytics';
import { analyticsRateLimit } from '../middleware/rateLimit';
import { cacheControl } from '../middleware/cache-control';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

// Apply middleware to all analytics routes
router.use(authenticateJWT); // First authenticate the user
router.use(authorizeRoles('admin')); // Then check if they are an admin
router.use(analyticsRateLimit);
router.use(validateAnalyticsQuery);

// Cache control settings per endpoint type
const CACHE_SETTINGS = {
  overview: { maxAge: 300, staleWhileRevalidate: 60 },    // 5 min
  revenue: { maxAge: 1800, staleWhileRevalidate: 300 },   // 30 min
  orders: { maxAge: 900, staleWhileRevalidate: 180 },     // 15 min
  products: { maxAge: 3600, staleWhileRevalidate: 600 },  // 1 hour
  customers: { maxAge: 3600, staleWhileRevalidate: 600 }, // 1 hour
};

// Overview Analytics
router.get('/overview', 
  cacheControl(CACHE_SETTINGS.overview),
  analyticsController.getOverviewStats
);

// Revenue Analytics
router.get('/revenue', 
  cacheControl(CACHE_SETTINGS.revenue),
  analyticsController.getRevenueStats
);

// Order Analytics
router.get('/orders', 
  cacheControl(CACHE_SETTINGS.orders),
  analyticsController.getOrderStats
);

// Product Analytics
router.get('/products', 
  cacheControl(CACHE_SETTINGS.products),
  analyticsController.getProductStats
);

router.get('/products/top-selling', 
  cacheControl(CACHE_SETTINGS.products),
  analyticsController.getTopSellingProducts
);

router.get('/products/low-stock', 
  cacheControl(CACHE_SETTINGS.products),
  analyticsController.getLowStockProducts
);

router.get('/products/by-category', 
  cacheControl(CACHE_SETTINGS.products),
  analyticsController.getProductsByCategory
);

// Customer Analytics
router.get('/customers', 
  cacheControl(CACHE_SETTINGS.customers),
  analyticsController.getCustomerStats
);

export default router;
