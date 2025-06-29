import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { AuthRequest } from '../middleware/auth';
import Logger from '../utils/logger';

const notificationService = new NotificationService();

// Get user notifications
export const getUserNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const notifications = await notificationService.getUserNotifications(
      userId,
      {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: Boolean(unreadOnly)
      }
    );

    res.json(notifications);
  } catch (error) {
    Logger.error('Error fetching user notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Get unread notification count
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    Logger.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
};

// Get notification statistics
export const getNotificationStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const stats = await notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    Logger.error('Error fetching notification stats:', error);
    res.status(500).json({ message: 'Failed to fetch notification stats' });
  }
};

// Mark notification as read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { id } = req.params;

    await notificationService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    Logger.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    Logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
};

// Delete notification
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { id } = req.params;

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    Logger.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};

// Stream notifications using Server-Sent Events
export const streamNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write('data: {"type":"connected","message":"Notification stream connected"}\n\n');

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      res.write('data: {"type":"heartbeat"}\n\n');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      res.end();
    });

  } catch (error) {
    Logger.error('Error setting up notification stream:', error);
    res.status(500).json({ message: 'Failed to setup notification stream' });
  }
};