import { 
  Notification, 
  NotificationTemplate, 
  NotificationPreferences, 
  CreateNotificationInput 
} from '../models/Notification';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { FirestoreService } from '../utils/firestore';
import { admin } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { realTimeNotificationService } from './realTimeNotificationService';
import { webSocketNotificationService } from './websocketNotificationService';

const notificationsCollection = FirestoreService.collection(COLLECTIONS.NOTIFICATIONS);
const preferencesCollection = FirestoreService.collection(COLLECTIONS.NOTIFICATION_PREFERENCES);
const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SMSData {
  to: string;
  message: string;
}

export interface PushData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class NotificationService {
  // Create a notification
  async createNotification(notificationData: CreateNotificationInput): Promise<Notification> {
    try {
      const now = new Date();
      
      // Handle broadcast notifications (userId: 'all')
      if (notificationData.userId === 'all') {
        return await this.createBroadcastNotification(notificationData);
      }
      
      const notification: Omit<Notification, 'id'> = {
        ...notificationData,
        priority: notificationData.priority || 'normal',
        status: 'pending',
        isRead: false,
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await notificationsCollection.add(notification);
      const createdNotification = { ...notification, id: docRef.id };

      // Send notification immediately if not scheduled
      if (!notification.scheduledFor) {
        await this.sendNotification(createdNotification);
      }

      // Send real-time notification for in-app notifications
      if (notification.channel === 'in_app') {
        realTimeNotificationService.sendNotificationToUser(notification.userId, createdNotification);
        
        // Send WebSocket notification
        await webSocketNotificationService.sendToUser(notification.userId, createdNotification);
        
        // Update unread count
        const unreadCount = await this.getUnreadCount(notification.userId);
        realTimeNotificationService.sendUnreadCountUpdate(notification.userId, unreadCount);
      }

      return createdNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  // Create broadcast notification for all users
  private async createBroadcastNotification(notificationData: CreateNotificationInput): Promise<Notification> {
    try {
      // Get all users (try active users first, then fallback to all users)
      const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);
      let usersSnapshot = await usersCollection
        .where('isActive', '==', true)
        .get();
      
      // If no active users found, get all users
      if (usersSnapshot.empty) {
        console.log('No active users found, getting all users for broadcast');
        usersSnapshot = await usersCollection.get();
      }
      
      const userIds = usersSnapshot.docs.map(doc => doc.id);
      
      if (userIds.length === 0) {
        throw new Error('No users found for broadcast');
      }
      
      console.log(`Broadcasting notification to ${userIds.length} users`);

      // Create notification for each user
      const now = new Date();
      const promises = userIds.map(async (userId) => {
        const notification: Omit<Notification, 'id'> = {
          ...notificationData,
          userId, // Set the actual user ID
          priority: notificationData.priority || 'normal',
          status: 'pending',
          isRead: false,
          retryCount: 0,
          maxRetries: 3,
          createdAt: now,
          updatedAt: now
        };

        const docRef = await notificationsCollection.add(notification);
        const createdNotification = { ...notification, id: docRef.id };

        // Send real-time notification for in-app notifications
        if (notification.channel === 'in_app') {
          realTimeNotificationService.sendNotificationToUser(userId, createdNotification);
          
          // Send WebSocket notification
          await webSocketNotificationService.sendToUser(userId, createdNotification);
          
          // Update unread count for this user
          const unreadCount = await this.getUnreadCount(userId);
          realTimeNotificationService.sendUnreadCountUpdate(userId, unreadCount);
        }

        return createdNotification;
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`Broadcast notification sent to ${successful} users, ${failed} failed`);

      // Log any failures for debugging
      if (failed > 0) {
        const failures = results
          .filter(result => result.status === 'rejected')
          .map(result => result.status === 'rejected' ? result.reason : null)
          .filter(Boolean);
        console.error('Broadcast failures:', failures.slice(0, 3)); // Log first 3 failures
      }

      // Return the first successful notification as representative
      const firstSuccess = results.find(result => result.status === 'fulfilled');
      if (firstSuccess && firstSuccess.status === 'fulfilled') {
        return firstSuccess.value;
      }

      // If no successful notifications, but we had users, create a fallback notification
      if (userIds.length > 0) {
        console.warn('All broadcast notifications failed, creating fallback notification');
        const fallbackNotification: Omit<Notification, 'id'> = {
          ...notificationData,
          userId: userIds[0], // Use first user as fallback
          priority: notificationData.priority || 'normal',
          status: 'pending',
          isRead: false,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const docRef = await notificationsCollection.add(fallbackNotification);
        return { ...fallbackNotification, id: docRef.id };
      }

      throw new Error('Failed to send broadcast notification to any users');
    } catch (error) {
      console.error('Error creating broadcast notification:', error);
      throw new Error('Failed to create broadcast notification');
    }
  }

  // Send notification (in-app only)
  async sendNotification(notification: Notification): Promise<void> {
    try {
      // Check user preferences for in-app notifications
      const preferences = await this.getUserPreferences(notification.userId);
      if (!this.shouldSendNotification(notification, preferences)) {
        await this.updateNotificationStatus(notification.id, 'delivered', 'Blocked by user preferences');
        return;
      }

      // For in-app notifications, we just mark as sent since they're stored in database
      // and delivered via real-time service
      await this.updateNotificationStatus(notification.id, 'sent');
      
      console.log(`In-app notification sent to user ${notification.userId}: ${notification.title}`);
    } catch (error) {
      console.error('Error sending notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', 'Internal error');
    }
  }

  // Note: Email and SMS functionality removed for now we'll add them soon - using in-app notifications only
  // This keeps the system simple and focused on web-based notifications

  // Check if notification should be sent based on user preferences (in-app only)
  private shouldSendNotification(notification: Notification, preferences: NotificationPreferences): boolean {
    
    switch (notification.type) {
      case 'order_update':
      case 'order_confirmation':
        return preferences.orderUpdates?.push ?? true; // Using push preference for in-app
      case 'promotion':
        return preferences.promotions?.push ?? true;
      case 'wishlist':
        return preferences.wishlistUpdates?.push ?? true;
      
      case 'review_request':
        return preferences.reviewRequests?.push ?? true;
      case 'abandoned_cart':
        return preferences.abandonedCart?.push ?? true;
      default:
        return true;
    }
  }

  // Get user notification preferences
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const doc = await preferencesCollection.doc(userId).get();
      
      if (doc.exists) {
        return {
          ...doc.data(),
          updatedAt: doc.data()?.updatedAt?.toDate()
        } as NotificationPreferences;
      }

      // Return default preferences (in-app notifications only)
      const defaultPreferences: NotificationPreferences = {
        userId,
        orderUpdates: { email: false, sms: false, push: true }, // push = in-app
        promotions: { email: false, sms: false, push: true },
        wishlistUpdates: { email: false, push: true },
        inventoryAlerts: { email: false, push: true },
        reviewRequests: { email: false, push: true },
        abandonedCart: { email: false, push: true },
        updatedAt: new Date()
      };

      await preferencesCollection.doc(userId).set(defaultPreferences);
      return defaultPreferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw new Error('Failed to get user preferences');
    }
  }

  // Update user notification preferences
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const updateData = {
        ...preferences,
        updatedAt: new Date()
      };

      await preferencesCollection.doc(userId).set(updateData, { merge: true });
      return await this.getUserPreferences(userId);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  }

  // Update notification status
  private async updateNotificationStatus(notificationId: string, status: Notification['status'], failureReason?: string): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === 'sent') {
      updateData.sentAt = new Date();
    } else if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'failed') {
      updateData.failureReason = failureReason;
    }

    await notificationsCollection.doc(notificationId).update(updateData);
  }

  // Schedule notification retry
  private async scheduleRetry(notification: Notification): Promise<void> {
    const retryDelay = Math.pow(2, notification.retryCount) * 60000; // Exponential backoff
    const scheduledFor = new Date(Date.now() + retryDelay);

    await notificationsCollection.doc(notification.id).update({
      retryCount: notification.retryCount + 1,
      scheduledFor,
      status: 'pending',
      updatedAt: new Date()
    });
  }





  // Send order confirmation notification
  async sendOrderConfirmation(order: Order): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: order.userId,
      type: 'order_confirmation',
      title: `Order Confirmed - ${order.orderNumber}`,
      message: `Thank you for your order! Your order ${order.orderNumber} has been confirmed and is being processed.`,
      data: { orderId: order.id, orderNumber: order.orderNumber, totalAmount: order.totalAmount },
      channel: 'in_app',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send order cancellation notification
  async sendOrderCancellation(order: Order, reason?: string): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: order.userId,
      type: 'order_update',
      title: `Order Cancelled - ${order.orderNumber}`,
      message: `Your order ${order.orderNumber} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
      data: { orderId: order.id, orderNumber: order.orderNumber, status: 'cancelled', reason },
      channel: 'in_app',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send order update notification
  async sendOrderUpdateNotification(order: Order, status: string): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: order.userId,
      type: 'order_update',
      title: `Order ${order.orderNumber} ${status}`,
      message: `Your order has been ${status.toLowerCase()}. ${this.getOrderStatusMessage(status)}`,
      data: { orderId: order.id, orderNumber: order.orderNumber, status },
      channel: 'in_app',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send order status update notification
  async sendOrderStatusUpdate(order: Order): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: order.userId,
      type: 'order_update',
      title: `Order Status Update - ${order.orderNumber}`,
      message: `Your order ${order.orderNumber} status has been updated to ${order.status}. ${this.getOrderStatusMessage(order.status)}`,
      data: { orderId: order.id, orderNumber: order.orderNumber, status: order.status },
      channel: 'in_app',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send abandoned cart notification
  async sendAbandonedCartNotification(userId: string, cartItems: any[]): Promise<void> {
    const notification: CreateNotificationInput = {
      userId,
      type: 'abandoned_cart',
      title: 'Don\'t forget your items!',
      message: `You have ${cartItems.length} item(s) waiting in your cart. Complete your purchase now!`,
      data: { cartItems },
      channel: 'in_app',
      priority: 'normal',
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours later
    };

    await this.createNotification(notification);
  }

  // Send welcome notification
  async sendWelcomeNotification(user: User): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: user.id,
      type: 'welcome',
      title: `Welcome to Sneakers Store, ${user.name}!`,
      message: 'Thank you for joining us. Explore our latest collection and enjoy exclusive member benefits.',
      channel: 'in_app',
      priority: 'normal'
    };

    await this.createNotification(notification);
  }

  // Send password reset notification
  async sendPasswordResetNotification(user: User, resetToken: string): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: user.id,
      type: 'password_reset',
      title: 'Password Reset Request',
      message: `You have requested to reset your password. Check your email for the reset link. This request will expire in 1 hour.`,
      data: { resetToken, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      channel: 'in_app',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send email verification notification
  async sendEmailVerificationNotification(user: User, verificationToken: string): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: user.id,
      type: 'email_verification',
      title: 'Verify Your Email Address',
      message: `Please check your email to verify your email address. The verification link will expire in 24 hours.`,
      data: { verificationToken, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      channel: 'in_app',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send promotional notification
  async sendPromotionalNotification(userId: string, title: string, message: string, data?: any): Promise<void> {
    const notification: CreateNotificationInput = {
      userId,
      type: 'promotion',
      title,
      message,
      data,
      channel: 'in_app',
      priority: 'normal'
    };

    await this.createNotification(notification);
  }

  // Send bulk promotional notifications to multiple users
  async sendBulkPromotionalNotification(userIds: string[], title: string, message: string, data?: any): Promise<void> {
    const notifications = userIds.map(userId => ({
      userId,
      type: 'promotion' as const,
      title,
      message,
      data,
      channel: 'in_app' as const,
      priority: 'normal' as const
    }));

    // Create notifications in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      await Promise.all(batch.map(notification => this.createNotification(notification)));
    }
  }

  

  // Send wishlist update notification
  async sendWishlistUpdate(userId: string, productName: string, updateType: 'price_drop' | 'back_in_stock' | 'sale', data?: any): Promise<void> {
    let title = '';
    let message = '';

    switch (updateType) {
      case 'price_drop':
        title = `Price Drop Alert: ${productName}`;
        message = `Great news! The price for ${productName} in your wishlist has dropped!`;
        break;
      case 'back_in_stock':
        title = `Back in Stock: ${productName}`;
        message = `${productName} from your wishlist is now back in stock!`;
        break;
      case 'sale':
        title = `Sale Alert: ${productName}`;
        message = `${productName} from your wishlist is now on sale!`;
        break;
    }

    const notification: CreateNotificationInput = {
      userId,
      type: 'wishlist',
      title,
      message,
      data: { productName, updateType, ...data },
      channel: 'in_app',
      priority: 'normal'
    };

    await this.createNotification(notification);
  }

  // Send general informational notification
  async sendInformationalNotification(userId: string, title: string, message: string, data?: any): Promise<void> {
    const notification: CreateNotificationInput = {
      userId,
      type: 'informational',
      title,
      message,
      data,
      channel: 'in_app',
      priority: 'normal'
    };

    await this.createNotification(notification);
  }

  // Send system announcement to all users
  async sendSystemAnnouncement(title: string, message: string, data?: any): Promise<void> {
    // This would typically get all active user IDs from the database
    // For now, we'll create a method that can be called with user IDs
    console.log('System announcement created:', { title, message, data });
    // Implementation would involve getting all user IDs and calling sendBulkPromotionalNotification
  }

  // Get order status message
  private getOrderStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      'confirmed': 'We\'re preparing your order for shipment.',
      'processing': 'Your order is being processed.',
      'shipped': 'Your order is on its way!',
      'delivered': 'Your order has been delivered.',
      'cancelled': 'Your order has been cancelled.',
      'refunded': 'Your refund has been processed.'
    };

    return messages[status] || 'Please check your order details for more information.';
  }

  // Process scheduled notifications
  async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const snapshot = await notificationsCollection
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', now)
        .limit(100)
        .get();

      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        scheduledFor: doc.data().scheduledFor?.toDate()
      })) as Notification[];

      for (const notification of notifications) {
        await this.sendNotification(notification);
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    }
  }

  // Get user notifications with pagination
  async getUserNotifications(userId: string, options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    featured?: boolean;
  } = {}): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 20, unreadOnly = false, featured } = options;
      const offset = (page - 1) * limit;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (offset < 0) {
        throw new Error('Invalid page number');
      }

      // Base query
      let query = notificationsCollection.where('userId', '==', userId);

      // Add filters
      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }
      
      if (featured !== undefined) {
        query = query.where('featured', '==', featured);
      }

      // Always order by createdAt desc
      query = query.orderBy('createdAt', 'desc');

      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      // Get total count
      const countSnapshot = await query.get();
      const total = countSnapshot.size;

      // Get paginated results
      const snapshot = await query.limit(limit).offset(offset).get();
      
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null,
        updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toDate() : null,
        readAt: doc.data().readAt ? doc.data().readAt.toDate() : null,
        scheduledFor: doc.data().scheduledFor ? doc.data().scheduledFor.toDate() : null,
        sentAt: doc.data().sentAt ? doc.data().sentAt.toDate() : null,
        deliveredAt: doc.data().deliveredAt ? doc.data().deliveredAt.toDate() : null,
        expiresAt: doc.data().expiresAt ? doc.data().expiresAt.toDate() : null
      })) as Notification[];

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      
      // Check for missing index error
      if (error instanceof Error && error.message.includes('FAILED_PRECONDITION')) {
        const indexMessage = error.message.includes('create_composite=') 
          ? 'Missing required index. Please wait while the index is being created.'
          : 'Missing required index. Please contact support.';
          
        throw new Error(indexMessage);
      }
      
      if (error instanceof Error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }
      throw new Error('Failed to fetch notifications: Unknown error');
    }
  }

  // Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const snapshot = await notificationsCollection
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();
      
      return snapshot.size;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    byType: Record<string, number>; 
    recent: number;
  }> {
    try {
      // Get all notifications for user (single query to avoid index requirements)
      const allSnapshot = await notificationsCollection
        .where('userId', '==', userId)
        .get();
      
      // Process all notifications in memory to avoid multiple queries
      const notifications = allSnapshot.docs.map(doc => doc.data() as Notification);
      
      // Calculate stats from the single result set
      const total = notifications.length;
      const unread = notifications.filter(n => !n.isRead).length;
      const read = total - unread;
      
      // Count by type
      const byType: Record<string, number> = {};
      notifications.forEach(notification => {
        byType[notification.type] = (byType[notification.type] || 0) + 1;
      });
      
      // Count recent notifications (last 7 days) - filter in memory
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recent = notifications.filter(notification => {
        let createdAt: Date | null = null;
        if (notification.createdAt) {
          // Handle both Date and Firestore Timestamp
          createdAt = notification.createdAt instanceof Date 
            ? notification.createdAt 
            : (notification.createdAt as any).toDate?.() || null;
        }
        return createdAt && createdAt >= sevenDaysAgo;
      }).length;
      
      return {
        total,
        unread,
        read,
        byType,
        recent
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw new Error('Failed to get notification stats');
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = notificationsCollection.doc(notificationId);
      const doc = await notificationRef.get();
      
      if (!doc.exists) {
        throw new Error('Notification not found');
      }
      
      const notification = doc.data() as Notification;
      if (notification.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }
      
      await notificationRef.update({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      });
      
      // Send real-time unread count update
      const unreadCount = await this.getUnreadCount(userId);
      realTimeNotificationService.sendUnreadCountUpdate(userId, unreadCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const snapshot = await notificationsCollection
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();
      
      const batch = notificationsCollection.firestore.batch();
      const now = new Date();
      
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          isRead: true,
          readAt: now,
          updatedAt: now
        });
      });
      
      await batch.commit();
      
      // Send real-time unread count update
      const unreadCount = await this.getUnreadCount(userId);
      realTimeNotificationService.sendUnreadCountUpdate(userId, unreadCount);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = notificationsCollection.doc(notificationId);
      const doc = await notificationRef.get();
      
      if (!doc.exists) {
        throw new Error('Notification not found');
      }
      
      const notification = doc.data() as Notification;
      if (notification.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }
      
      await notificationRef.delete();
      
      // Send real-time unread count update
      const unreadCount = await this.getUnreadCount(userId);
      realTimeNotificationService.sendUnreadCountUpdate(userId, unreadCount);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();