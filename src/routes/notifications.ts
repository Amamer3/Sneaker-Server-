import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all notification routes
router.use(authenticateJWT);

// Get user notifications
router.get('/', notificationController.getUserNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Get notification count (alias for frontend compatibility)
router.get('/count', notificationController.getUnreadCount);

// Get notification statistics
router.get('/stats', notificationController.getNotificationStats);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Server-Sent Events stream for real-time notifications
router.get('/stream', notificationController.streamNotifications);

// Get real-time connection status
router.get('/connection-status', notificationController.getConnectionStatus);

export default router;