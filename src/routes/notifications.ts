import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { authenticateJWT } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';

const router = Router();

// Test endpoint (no auth required) - moved to very top
router.get('/test-no-auth', async (req, res) => {
  try {
    // Create an instance of NotificationService
    const notificationService = new NotificationService();
    
    // Test the NotificationService directly
    const testNotification = {
      userId: 'test-user-123',
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'test' as const,
      channel: 'in_app' as const,
      data: { test: true }
    };
    
    const result = await notificationService.createNotification(testNotification);
    
    res.json({ 
      message: 'Notification service test successful', 
      timestamp: new Date().toISOString(),
      notificationId: result.id,
      testData: testNotification
    });
  } catch (error) {
    console.error('Notification service test error:', error);
    res.status(500).json({ 
      message: 'Notification service test failed', 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply authentication middleware to all notification routes
router.use(authenticateJWT);

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Notification routes are working', timestamp: new Date().toISOString() });
});

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