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

      return createdNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  // Send notification
  async sendNotification(notification: Notification): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      if (!this.shouldSendNotification(notification, preferences)) {
        await this.updateNotificationStatus(notification.id, 'delivered', 'Blocked by user preferences');
        return;
      }

      // Get user data
      const userDoc = await usersCollection.doc(notification.userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      const user = userDoc.data() as User;

      let success = false;
      let errorMessage = '';

      try {
        switch (notification.channel) {
          case 'email':
            await this.sendEmail(notification, user);
            break;
          case 'sms':
            await this.sendSMS(notification, user);
            break;
          case 'push':
            await this.sendPush(notification, user);
            break;
          case 'in_app':
            // In-app notifications are stored in database only
            break;
        }
        success = true;
      } catch (error: any) {
        errorMessage = error.message;
        console.error(`Error sending ${notification.channel} notification:`, error);
      }

      // Update notification status
      if (success) {
        await this.updateNotificationStatus(notification.id, 'sent');
      } else {
        await this.updateNotificationStatus(notification.id, 'failed', errorMessage);
        
        // Retry if under max retries
        if (notification.retryCount < notification.maxRetries) {
          await this.scheduleRetry(notification);
        }
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', 'Internal error');
    }
  }

  // Send email notification
  private async sendEmail(notification: Notification, user: User): Promise<void> {
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    // For now, we'll just log the email data
    const emailData: EmailData = {
      to: user.email,
      subject: notification.title,
      html: this.generateEmailHTML(notification, user),
      text: notification.message
    };

    console.log('Sending email:', emailData);
    // await emailService.send(emailData);
  }

  // Send SMS notification
  private async sendSMS(notification: Notification, user: User): Promise<void> {
    if (!user.profile?.phone) {
      throw new Error('User phone number not available');
    }

    const smsData: SMSData = {
      to: user.profile.phone,
      message: `${notification.title}: ${notification.message}`
    };

    console.log('Sending SMS:', smsData);
    // await smsService.send(smsData);
  }

  // Send push notification
  private async sendPush(notification: Notification, user: User): Promise<void> {
    const pushData: PushData = {
      userId: user.id,
      title: notification.title,
      body: notification.message,
      data: notification.data
    };

    console.log('Sending push notification:', pushData);
    // await pushService.send(pushData);
  }

  // Generate email HTML
  private generateEmailHTML(notification: Notification, user: User): string {
    return `
      <html>
        <body>
          <h2>${notification.title}</h2>
          <p>Hi ${user.name},</p>
          <p>${notification.message}</p>
          ${notification.actions ? this.generateActionButtons(notification.actions) : ''}
          <p>Best regards,<br>Your Sneakers Store Team</p>
        </body>
      </html>
    `;
  }

  // Generate action buttons for email
  private generateActionButtons(actions: any[]): string {
    return actions.map(action => 
      `<a href="${action.url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px;">${action.label}</a>`
    ).join('');
  }

  // Check if notification should be sent based on user preferences
  private shouldSendNotification(notification: Notification, preferences: NotificationPreferences): boolean {
    switch (notification.type) {
      case 'order_update':
        return preferences.orderUpdates[notification.channel as keyof typeof preferences.orderUpdates] ?? true;
      case 'promotion':
        return preferences.promotions[notification.channel as keyof typeof preferences.promotions] ?? true;
      case 'wishlist':
        return preferences.wishlistUpdates[notification.channel as keyof typeof preferences.wishlistUpdates] ?? true;
      case 'inventory':
        return preferences.inventoryAlerts[notification.channel as keyof typeof preferences.inventoryAlerts] ?? true;
      case 'review_request':
        return preferences.reviewRequests[notification.channel as keyof typeof preferences.reviewRequests] ?? true;
      case 'abandoned_cart':
        return preferences.abandonedCart[notification.channel as keyof typeof preferences.abandonedCart] ?? true;
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

      // Return default preferences
      const defaultPreferences: NotificationPreferences = {
        userId,
        orderUpdates: { email: true, sms: true, push: true },
        promotions: { email: true, sms: false, push: true },
        wishlistUpdates: { email: true, push: true },
        inventoryAlerts: { email: true, push: true },
        reviewRequests: { email: true, push: true },
        abandonedCart: { email: true, push: true },
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
      channel: 'email',
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
      channel: 'email',
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
      channel: 'email',
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
      channel: 'email',
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
      channel: 'email',
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
      channel: 'email',
      priority: 'normal'
    };

    await this.createNotification(notification);
  }

  // Send password reset email
  async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: user.id,
      type: 'password_reset',
      title: 'Password Reset Request',
      message: `You have requested to reset your password. Use the following token to reset your password: ${resetToken}. This token will expire in 1 hour.`,
      data: { resetToken, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      channel: 'email',
      priority: 'high'
    };

    await this.createNotification(notification);
  }

  // Send email verification
  async sendEmailVerification(user: User, verificationToken: string): Promise<void> {
    const notification: CreateNotificationInput = {
      userId: user.id,
      type: 'email_verification',
      title: 'Verify Your Email Address',
      message: `Please verify your email address by using the following verification token: ${verificationToken}. This token will expire in 24 hours.`,
      data: { verificationToken, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      channel: 'email',
      priority: 'high'
    };

    await this.createNotification(notification);
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
  } = {}): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = options;
      const offset = (page - 1) * limit;

      let query = notificationsCollection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

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
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        readAt: doc.data().readAt?.toDate(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
        deliveredAt: doc.data().deliveredAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate()
      })) as Notification[];

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
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
      // Get all notifications for user
      const allSnapshot = await notificationsCollection
        .where('userId', '==', userId)
        .get();
      
      // Get unread notifications
      const unreadSnapshot = await notificationsCollection
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();
      
      // Get recent notifications (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentSnapshot = await notificationsCollection
        .where('userId', '==', userId)
        .where('createdAt', '>=', sevenDaysAgo)
        .get();
      
      // Count by type
      const byType: Record<string, number> = {};
      allSnapshot.docs.forEach((doc: any) => {
        const data = doc.data() as Notification;
        byType[data.type] = (byType[data.type] || 0) + 1;
      });
      
      const total = allSnapshot.size;
      const unread = unreadSnapshot.size;
      
      return {
        total,
        unread,
        read: total - unread,
        byType,
        recent: recentSnapshot.size
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
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();