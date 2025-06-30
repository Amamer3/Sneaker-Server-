export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  WISHLISTS: 'wishlists',
  CARTS: 'carts',
  ORDERS: 'orders',
  REVIEWS: 'reviews',
  CATEGORIES: 'categories',
  METRICS: 'metrics',
  LOGS: 'logs',
  LOGIN_LOGS: 'login_logs',
  ALERTS: 'alerts',
  INVENTORY: 'inventory',
  STOCK_MOVEMENTS: 'stock_movements',
  STOCK_ALERTS: 'stock_alerts',
  STOCK_RESERVATIONS: 'stock_reservations',
  COUPONS: 'coupons',
  COUPON_USAGE: 'coupon_usage',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  NOTIFICATION_TEMPLATES: 'notificationTemplates'
} as const;

export const SUB_COLLECTIONS = {
  ADDRESSES: 'addresses',
  REVIEWS: 'reviews',
  ORDER_ITEMS: 'orderItems',
  CART_ITEMS: 'cartItems'
} as const;

// Type for collection names
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// Type for sub-collection names
export type SubCollectionName = typeof SUB_COLLECTIONS[keyof typeof SUB_COLLECTIONS];
