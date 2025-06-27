// Firestore collection names
export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  REVIEWS: 'reviews',
  WISHLISTS: 'wishlists',
  CARTS: 'carts',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  INVENTORY: 'inventory',
  STOCK_MOVEMENTS: 'stock_movements',
  ANALYTICS: 'analytics',
  DELIVERY_ZONES: 'delivery_zones',
  PAYMENT_METHODS: 'payment_methods'
};

// API response status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

// Default pagination settings
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Notification types
export const NOTIFICATION_TYPES = {
  ORDER_UPDATE: 'order_update',
  ORDER_CONFIRMATION: 'order_confirmation',
  PROMOTION: 'promotion',
  SYSTEM: 'system',
  WISHLIST: 'wishlist',
  INVENTORY: 'inventory',
  REVIEW_REQUEST: 'review_request',
  WELCOME: 'welcome',
  ABANDONED_CART: 'abandoned_cart',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification'
};

// Notification channels
export const NOTIFICATION_CHANNELS = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push'
};

// Order statuses
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};