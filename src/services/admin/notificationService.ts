import { FirestoreService } from '../../utils/firestore';
import { COLLECTIONS } from '../../constants/collections';
import Logger from '../../utils/logger';
import { notificationService } from '../notificationService';

interface NotificationTemplate {
  id?: string;
  name: string;
  type: 'order_update' | 'promotion' | 'system' | 'wishlist' | 'inventory' | 'review_request' | 'welcome' | 'abandoned_cart' | 'order_confirmation' | 'password_reset' | 'email_verification';
  title: string;
  message: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const templatesCollection = FirestoreService.collection(COLLECTIONS.NOTIFICATION_TEMPLATES);

class AdminNotificationService {

  /**
   * Get all notification templates
   */
  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    try {
      const snapshot = await templatesCollection
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationTemplate[];
    } catch (error) {
      Logger.error('Error getting notification templates:', error);
      throw new Error('Failed to get notification templates');
    }
  }

  /**
   * Create a new notification template
   */
  async createNotificationTemplate(templateData: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<NotificationTemplate> {
    try {
      const now = new Date();
      const template: Omit<NotificationTemplate, 'id'> = {
        ...templateData,
        createdAt: now,
        updatedAt: now,
        isActive: true
      };

      const docRef = await templatesCollection.add(template);
      
      return {
        id: docRef.id,
        ...template
      };
    } catch (error) {
      Logger.error('Error creating notification template:', error);
      throw new Error('Failed to create notification template');
    }
  }

  /**
   * Update a notification template
   */
  async updateNotificationTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await templatesCollection.doc(templateId).update(updateData);
      
      const doc = await templatesCollection.doc(templateId).get();
      
      if (!doc.exists) {
        throw new Error('Template not found');
      }

      return {
        id: doc.id,
        ...doc.data()
      } as NotificationTemplate;
    } catch (error) {
      Logger.error('Error updating notification template:', error);
      throw new Error('Failed to update notification template');
    }
  }

  /**
   * Delete a notification template
   */
  async deleteNotificationTemplate(templateId: string): Promise<void> {
    try {
      await templatesCollection.doc(templateId).delete();
    } catch (error) {
      Logger.error('Error deleting notification template:', error);
      throw new Error('Failed to delete notification template');
    }
  }

  /**
   * Send bulk notifications using a template
   */
  async sendBulkNotifications(
    templateId: string,
    userIds?: string[],
    variables?: Record<string, string>
  ): Promise<{ sent: number; failed: number }> {
    try {
      // Get the template
      const templateDoc = await templatesCollection.doc(templateId).get();
      
      if (!templateDoc.exists) {
        throw new Error('Template not found');
      }

      const template = templateDoc.data() as NotificationTemplate;
      
      // If no userIds provided, get all active users
      let targetUserIds = userIds;
      if (!targetUserIds || targetUserIds.length === 0) {
        const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);
        const usersSnapshot = await usersCollection
          .where('isActive', '==', true)
          .get();
        targetUserIds = usersSnapshot.docs.map((doc: any) => doc.id);
      }

      // Replace variables in template
      let title = template.title;
      let message = template.message;
      
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`;
          title = title.replace(new RegExp(placeholder, 'g'), value);
          message = message.replace(new RegExp(placeholder, 'g'), value);
        });
      }

      // Send notifications
      let sent = 0;
      let failed = 0;

      if (!targetUserIds || targetUserIds.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const promises = targetUserIds.map(async (userId) => {
        try {
          await notificationService.createNotification({
            userId,
            type: template.type,
            title,
            message,
            data: variables || {},
            channel: 'in_app'
          });
          sent++;
        } catch (error) {
          Logger.error(`Failed to send notification to user ${userId}:`, error);
          failed++;
        }
      });

      await Promise.allSettled(promises);

      return { sent, failed };
    } catch (error) {
      Logger.error('Error sending bulk notifications:', error);
      throw new Error('Failed to send bulk notifications');
    }
  }
}

export const adminNotificationService = new AdminNotificationService();