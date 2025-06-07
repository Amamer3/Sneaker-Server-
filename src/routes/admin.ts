import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

// Apply authentication and admin role check to all routes
router.use(authenticateJWT);
router.use(authorizeRoles('admin'));

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getDashboardStats);
router.get('/dashboard/recent-orders', dashboardController.getRecentOrders);

export default router;
