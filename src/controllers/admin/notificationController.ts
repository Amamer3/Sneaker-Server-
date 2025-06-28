import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import Logger from '../../utils/logger';
import { adminNotificationService } from '../../services/admin/notificationService';

// Get notification templates
export const getNotificationTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await adminNotificationService.getNotificationTemplates();

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    Logger.error('Error fetching notification templates:', error);
    res.status(500).json({ message: 'Failed to fetch notification templates' });
  }
};

// Create notification template
export const createNotificationTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, title, message, variables } = req.body;

    if (!name || !type || !title || !message) {
      res.status(400).json({ message: 'Name, type, title, and message are required' });
      return;
    }

    const template = await adminNotificationService.createNotificationTemplate({
      name,
      type,
      title,
      message,
      variables: variables || []
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    Logger.error('Error creating notification template:', error);
    res.status(500).json({ message: 'Failed to create notification template' });
  }
};

// Update notification template
export const updateNotificationTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await adminNotificationService.updateNotificationTemplate(id, updates);

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    Logger.error('Error updating notification template:', error);
    res.status(500).json({ message: 'Failed to update notification template' });
  }
};

// Delete notification template
export const deleteNotificationTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await adminNotificationService.deleteNotificationTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    Logger.error('Error deleting notification template:', error);
    res.status(500).json({ message: 'Failed to delete notification template' });
  }
};

// Send bulk notifications
export const sendBulkNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId, userIds, variables } = req.body;

    if (!templateId) {
      res.status(400).json({ message: 'Template ID is required' });
      return;
    }

    const result = await adminNotificationService.sendBulkNotifications(
      templateId,
      userIds,
      variables
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    Logger.error('Error sending bulk notifications:', error);
    res.status(500).json({ message: 'Failed to send bulk notifications' });
  }
};