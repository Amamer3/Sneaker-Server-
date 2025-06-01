import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

// Product Analytics
router.get('/products/top-selling', analyticsController.getTopSellingProducts);
router.get('/products/low-stock', analyticsController.getLowStockProducts);
router.get('/products/by-category', analyticsController.getProductsByCategory);

export default router;
