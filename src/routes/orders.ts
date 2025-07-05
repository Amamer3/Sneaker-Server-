import { Router, Request, Response, NextFunction } from 'express';
import * as orderController from '../controllers/orderController';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';

const router = Router(); 

// User routes
router.post('/', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  orderController.createOrder(authReq, res, next);
});

router.get('/my', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  orderController.getUserOrders(req, res, next);
});

router.get('/:id', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  orderController.getOrderById(req, res, next);
});

// Admin routes
router.get('/', authenticateJWT, authorizeRoles('admin'), (req, res, next) => {
  const authReq = req as AuthRequest;
  orderController.getAllOrders(authReq, res, next);
});

// Support both PUT and PATCH for order status updates
router.put('/:id/status', authenticateJWT, authorizeRoles('admin'), (req, res, next) => {
  const authReq = req as AuthRequest;
  orderController.updateOrderStatus(authReq, res, next);
});

router.patch('/:id/status', authenticateJWT, authorizeRoles('admin'), (req, res, next) => {
  const authReq = req as AuthRequest;
  orderController.updateOrderStatus(authReq, res, next);
});

// Export orders (admin only)
router.get('/export', authenticateJWT, authorizeRoles('admin'), (req, res, next) => {
  const authReq = req as AuthRequest;
  orderController.exportOrders(authReq, res, next);
});

export default router;
