import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { NotificationPreferences } from '../models/Notification';
import Logger from '../utils/logger';

// Get user notification preferences
export const getUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const preferences = await notificationService.getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    Logger.error('Error fetching user notification preferences:', error);
    res.status(500).json({ message: 'Failed to fetch notification preferences' });
  }
};

// Update user notification preferences
export const updateUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const updates = req.body;
    
    // Validate the updates structure
    if (!isValidPreferencesUpdate(updates)) {
      res.status(400).json({ message: 'Invalid preferences format' });
      return;
    }

    const updatedPreferences = await notificationService.updateUserPreferences(userId, updates);

    res.json({
      success: true,
      data: updatedPreferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    Logger.error('Error updating user notification preferences:', error);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
};

// Reset preferences to default
export const resetPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    // Create default preferences
    const defaultPreferences: Partial<NotificationPreferences> = {
      orderUpdates: { email: true, sms: true, push: true },
      promotions: { email: true, sms: false, push: true },
      wishlistUpdates: { email: true, push: true },
      inventoryAlerts: { email: true, push: true },
      reviewRequests: { email: true, push: true },
      abandonedCart: { email: true, push: true }
    };

    const resetPreferences = await notificationService.updateUserPreferences(userId, defaultPreferences);

    res.json({
      success: true,
      data: resetPreferences,
      message: 'Notification preferences reset to default'
    });
  } catch (error) {
    Logger.error('Error resetting user notification preferences:', error);
    res.status(500).json({ message: 'Failed to reset notification preferences' });
  }
};

// Helper function to validate preferences update structure
function isValidPreferencesUpdate(updates: any): boolean {
  const validChannels = ['email', 'sms', 'push'];
  const validCategories = [
    'orderUpdates',
    'promotions', 
    'wishlistUpdates',
    'inventoryAlerts',
    'reviewRequests',
    'abandonedCart'
  ];

  for (const [category, channels] of Object.entries(updates)) {
    if (category === 'updatedAt') continue; // Skip timestamp field
    
    if (!validCategories.includes(category)) {
      return false;
    }
    
    if (typeof channels !== 'object' || channels === null) {
      return false;
    }
    
    for (const [channel, enabled] of Object.entries(channels as Record<string, any>)) {
      if (!validChannels.includes(channel)) {
        return false;
      }
      
      if (typeof enabled !== 'boolean') {
        return false;
      }
    }
  }
  
  return true;
}