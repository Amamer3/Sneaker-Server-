import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';
import { realTimeNotificationService } from '../services/realTimeNotificationService';
import { CreateNotificationInput } from '../models/Notification';
import Logger from '../utils/logger';

const notificationService = new NotificationService();

// Get user notifications
export const getUserNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const notifications = await notificationService.getUserNotifications(
      userId,
      {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: unreadOnly === 'true'
      }
    );

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    Logger.error('Error fetching user notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get unread notification count
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count }
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
      res.status(401).json({ message: 'User not authenticated' });
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
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

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
      res.status(401).json({ message: 'User not authenticated' });
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
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

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

    // Add connection to real-time service
    realTimeNotificationService.addConnection(userId, res);
    
    Logger.info(`Real-time notification stream established for user: ${userId}`);
    
  } catch (error) {
    Logger.error('Error setting up notification stream:', error);
    res.status(500).json({ message: 'Failed to setup notification stream' });
  }
};

// Get real-time connection status
export const getConnectionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const connectionCount = realTimeNotificationService.getUserConnectionCount(userId);
    const totalConnections = realTimeNotificationService.getTotalConnections();

    res.json({
      success: true,
      data: {
        userConnections: connectionCount,
        totalConnections,
        isConnected: connectionCount > 0
      }
    });
  } catch (error) {
    Logger.error('Error getting connection status:', error);
    res.status(500).json({ message: 'Failed to get connection status' });
  }
};

// Create notification
export const createNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const notificationData: CreateNotificationInput = {
      ...req.body,
      userId: req.body.userId || userId // Allow admin to specify userId, default to current user
    };

    // Validate required fields
    if (!notificationData.title || !notificationData.message) {
      res.status(400).json({ 
        success: false,
        message: 'Title and message are required' 
      });
      return;
    }

    const notification = await notificationService.createNotification(notificationData);

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    });
  } catch (error) {
    Logger.error('Error creating notification:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};