import { Product } from './Product';

export interface WishlistItem {
  productId: string;
  addedAt: Date;
}

export interface Wishlist {
  id: string;
  userId: string;
  items: WishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrichedWishlist extends Omit<Wishlist, 'items'> {
  items: Array<WishlistItem & { product: Product | null }>;

}
