import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';
import * as userController from '../controllers/userController';
import { inventoryController } from '../controllers/inventoryController';

const router = Router();

// Apply authentication and admin role check to all routes
router.use(authenticateJWT);
router.use(authorizeRoles('admin'));

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getDashboardStats);
router.get('/dashboard/recent-orders', dashboardController.getRecentOrders);

// User management routes
router.get('/users', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.getAllUsers(authReq, res, next);
});

router.delete('/users/:userId', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.deleteUser(authReq, res, next);
});

// Inventory management routes
router.get('/inventory/movements', (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  inventoryController.getStockMovements(authReq, res);
});
router.get('/inventory/summary', (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  inventoryController.getInventorySummary(authReq, res);
});

export default router;
