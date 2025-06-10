// Base interface for both guest and stored cart items
interface BaseCartItem {
  productId: string;
  size?: string;
  quantity: number;
  price: number;
  name?: string;    // Optional product name for guest cart
  image?: string;   // Optional product image for guest cart
}

// Guest cart item (no dates or IDs required)
export interface GuestCartItem extends BaseCartItem {}

// Stored cart item (with dates)
export interface StoredCartItem extends BaseCartItem {
  createdAt: Date;
  updatedAt: Date;
}

// The type used in most operations
export type CartItem = StoredCartItem;

// Base cart interface
interface BaseCart {
  items: CartItem[];
  total: number;
}

// Guest cart (minimal requirements)
export interface GuestCart extends BaseCart {
  userId?: never;  // Guest carts don't have a user ID
}

// Stored cart (full requirements)
export interface StoredCart extends BaseCart {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// The type used in most operations
export type Cart = StoredCart;
