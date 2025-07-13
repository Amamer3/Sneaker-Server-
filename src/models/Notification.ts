export interface NotificationAction {
  type: 'link' | 'button' | 'dismiss';
  label: string;
  url?: string;
  action?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'order_update' | 'order_confirmation' | 'promotion' | 'system' | 'wishlist' | 'inventory' | 'review_request' | 'welcome' | 'abandoned_cart' | 'password_reset' | 'email_verification' | 'informational' | 'test';
  title: string;
  message: string;
  data?: Record<string, any>; // Additional data for the notification
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'in_app' | 'email' | 'sms' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  isRead: boolean;
  readAt?: Date;
  actions?: NotificationAction[];
  expiresAt?: Date;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'order_update' | 'promotion' | 'system' | 'wishlist' | 'inventory' | 'review_request' | 'welcome' | 'abandoned_cart' | 'order_confirmation' | 'password_reset' | 'email_verification' | 'informational' | 'test';
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  smsTemplate?: string;
  pushTemplate?: string;
  variables: string[]; // List of variables that can be used in templates
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  orderUpdates: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  promotions: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  wishlistUpdates: {
    email: boolean;
    push: boolean;
  };
  inventoryAlerts: {
    email: boolean;
    push: boolean;
  };
  reviewRequests: {
    email: boolean;
    push: boolean;
  };
  abandonedCart: {
    email: boolean;
    push: boolean;
  };
  updatedAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: 'order_update' | 'promotion' | 'system' | 'wishlist' | 'inventory' | 'review_request' | 'welcome' | 'abandoned_cart' | 'order_confirmation' | 'password_reset' | 'email_verification' | 'informational' | 'test';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'in_app' | 'email' | 'sms' | 'push';
  actions?: NotificationAction[];
  expiresAt?: Date;
  scheduledFor?: Date;
}