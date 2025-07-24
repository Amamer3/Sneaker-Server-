import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';
import * as userController from '../controllers/userController';
import * as couponController from '../controllers/couponController';
import { cleanupInvalidImages } from '../utils/cleanupInvalidImages';

import adminNotificationRoutes from './admin/notifications';
import testNotificationRoutes from './admin/testNotifications';

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



// Admin profile activity endpoint
router.get('/profile/activity', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.getAdminActivity(authReq, res, next);
});

// Admin coupon routes
router.get('/coupons', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  couponController.getAllCoupons(authReq, res).catch(next);
});

router.get('/coupons/stats', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  couponController.getCouponStats(authReq, res).catch(next);
});

router.post('/coupons', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  couponController.createCoupon(authReq, res).catch(next);
});

router.put('/coupons/:id', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  couponController.updateCoupon(authReq, res).catch(next);
});

router.delete('/coupons/:id', (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  couponController.deleteCoupon(authReq, res).catch(next);
});

// Image cleanup endpoint
router.post('/cleanup-images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🧹 Starting image cleanup process...');
    await cleanupInvalidImages();
    
    res.json({
      success: true,
      message: 'Image cleanup completed successfully'
    });
  } catch (error) {
    console.error('Image cleanup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Image cleanup failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mount admin notification routes
router.use('/notifications', adminNotificationRoutes);
router.use('/test-notifications', testNotificationRoutes);

export default router;
