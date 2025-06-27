import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as notificationController from '../controllers/notificationController';

const router = Router();

// Apply authentication to all notification routes
router.use(authenticateJWT);

// Get user notifications
router.get('/', notificationController.getUserNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

export default router;