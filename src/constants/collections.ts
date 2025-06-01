export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  WISHLISTS: 'wishlists',
  CARTS: 'carts',
  ORDERS: 'orders',
  REVIEWS: 'reviews',
  CATEGORIES: 'categories'
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
