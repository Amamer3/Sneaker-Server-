import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

console.log('🔔 Loading notification routes...');

// Apply authentication middleware to all notification routes
router.use(authenticateJWT);

console.log('🔔 Notification routes middleware applied');

// Add request logging middleware
router.use((req, res, next) => {
  console.log(`🔍 Notification route accessed: ${req.method} ${req.path}`);
  console.log(`🔍 Full URL: ${req.originalUrl}`);
  console.log(`🔍 Headers:`, req.headers);
  next();
});

// Get user notifications
router.get('/', notificationController.getUserNotifications);

// Create notification
console.log('🔔 Registering POST / route for notifications');
router.post('/', notificationController.createNotification);
console.log('🔔 POST / route registered successfully');

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Get notification count (alias for frontend compatibility)
router.get('/count', notificationController.getUnreadCount);

// Get notification statistics
router.get('/stats', notificationController.getNotificationStats);

// Mark notification as read (support both PUT and PATCH)
router.put('/:id/read', notificationController.markAsRead);
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read (support both PUT and PATCH)
router.put('/mark-all-read', notificationController.markAllAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Server-Sent Events stream for real-time notifications
router.get('/stream', notificationController.streamNotifications);

// Get real-time connection status
router.get('/connection-status', notificationController.getConnectionStatus);

console.log('🔔 Notification routes setup complete, exporting router');
export default router;