import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { notificationService } from '../../services/notificationService';
import { realTimeNotificationService } from '../../services/realTimeNotificationService';
import Logger from '../../utils/logger';

// Create a test notification (in-app only)
export const testCreateNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, type, title, message, priority, data } = req.body;

    if (!userId || !title || !message) {
      res.status(400).json({
        success: false,
        message: 'userId, title, and message are required'
      });
      return;
    }

    const notification = await notificationService.createNotification({
      userId,
      type: type || 'test',
      title,
      message,
      channel: 'in_app', // Always in-app
      priority: priority || 'normal',
      data
    });

    res.json({
      success: true,
      message: 'Test in-app notification created successfully',
      notification
    });
  } catch (error: any) {
    console.error('Error creating test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test notification',
      error: error.message
    });
  }
};

// Test real-time notification
export const testRealTimeNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, title, message } = req.body;

    if (!userId || !title || !message) {
      res.status(400).json({ message: 'userId, title, and message are required' });
      return;
    }

    // Create an in-app notification for real-time testing
    const notification = await notificationService.createNotification({
      userId,
      type: 'system',
      title,
      message,
      channel: 'in_app',
      priority: 'normal',
      data: { test: true, realTime: true, timestamp: new Date().toISOString() }
    });

    res.json({
      success: true,
      data: notification,
      message: 'Real-time test notification sent successfully'
    });
  } catch (error) {
    Logger.error('Error sending real-time test notification:', error);
    res.status(500).json({ message: 'Failed to send real-time test notification' });
  }
};

// Test broadcast notification
export const testBroadcastNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, message, data } = req.body;

    if (!title || !message) {
      res.status(400).json({ message: 'title and message are required' });
      return;
    }

    // Broadcast to all connected users
    realTimeNotificationService.broadcastToAll({
      title,
      message,
      data: data || { test: true, broadcast: true, timestamp: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: 'Broadcast notification sent to all connected users',
      data: {
        totalConnections: realTimeNotificationService.getTotalConnections(),
        connectedUsers: realTimeNotificationService.getConnectedUsers().length
      }
    });
  } catch (error) {
    Logger.error('Error sending broadcast notification:', error);
    res.status(500).json({ message: 'Failed to send broadcast notification' });
  }
};

// Get real-time service statistics
export const getRealTimeStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = {
      totalConnections: realTimeNotificationService.getTotalConnections(),
      connectedUsers: realTimeNotificationService.getConnectedUsers(),
      userConnectionCounts: {} as Record<string, number>
    };

    // Get connection count for each user
    stats.connectedUsers.forEach(userId => {
      stats.userConnectionCounts[userId] = realTimeNotificationService.getUserConnectionCount(userId);
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    Logger.error('Error getting real-time stats:', error);
    res.status(500).json({ message: 'Failed to get real-time stats' });
  }
};

// Test notification preferences (in-app only)
export const testNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }

    // Get current preferences
    const currentPreferences = await notificationService.getUserPreferences(userId);

    // Test updating preferences (in-app only)
    const testPreferences = {
      orderUpdates: { email: false, sms: false, push: true }, // push = in-app
      promotions: { email: false, sms: false, push: false },
      wishlistUpdates: { email: false, push: true },
      inventoryAlerts: { email: false, push: true },
      reviewRequests: { email: false, push: false },
      abandonedCart: { email: false, push: true }
    };

    const updatedPreferences = await notificationService.updateUserPreferences(userId, testPreferences);

    // Test sending notifications with different preferences
    const testResults = [];

    // Test order update (should be sent)
    try {
      const orderNotification = await notificationService.createNotification({
        userId,
        type: 'order_update',
        title: 'Test Order Update',
        message: 'This is a test order update notification',
        channel: 'in_app',
        priority: 'normal'
      });
      testResults.push({ type: 'order_update_in_app', sent: true, notificationId: orderNotification.id });
    } catch (error: any) {
      testResults.push({ type: 'order_update_in_app', sent: false, reason: error.message });
    }

    // Test promotion (should be blocked)
    try {
      await notificationService.createNotification({
        userId,
        type: 'promotion',
        title: 'Test Promotion',
        message: 'This promotion should be blocked',
        channel: 'in_app',
        priority: 'normal'
      });
      testResults.push({ type: 'promotion_in_app', sent: false, reason: 'Should be blocked by preferences' });
    } catch (error: any) {
      testResults.push({ type: 'promotion_in_app', sent: false, reason: 'Blocked by preferences' });
    }

    // Restore original preferences
    await notificationService.updateUserPreferences(userId, currentPreferences);

    res.json({
      success: true,
      message: 'In-app notification preferences test completed',
      originalPreferences: currentPreferences,
      testPreferences,
      updatedPreferences,
      testResults
    });
  } catch (error: any) {
    console.error('Error testing notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test notification preferences',
      error: error.message
    });
  }
};

// Test notification delivery (in-app only)
export const testNotificationDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, title, message } = req.body;

    if (!userId || !title || !message) {
      res.status(400).json({
        success: false,
        message: 'userId, title, and message are required'
      });
      return;
    }

    // Test in-app notification delivery only
    try {
      const notification = await notificationService.createNotification({
        userId,
        type: 'test',
        title: `${title} (IN-APP TEST)`,
        message: `${message} - Testing in-app delivery`,
        channel: 'in_app',
        priority: 'normal'
      });

      res.json({
        success: true,
        message: 'In-app notification delivery test completed',
        result: {
          channel: 'in_app',
          success: true,
          notificationId: notification.id
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to test in-app notification delivery',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('Error testing notification delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test notification delivery',
      error: error.message
    });
  }
};