import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Wishlist } from '../models/Wishlist';

export class WishlistService {
  private collection = FirestoreService.collection(COLLECTIONS.WISHLISTS);

  async getWishlist(userId: string): Promise<Wishlist | null> {
    const doc = await this.collection.where('userId', '==', userId).limit(1).get();
    if (doc.empty) return null;
    const wishlist = doc.docs[0].data() as Wishlist;
    wishlist.id = doc.docs[0].id;
    return wishlist;
  }

  async createWishlist(userId: string): Promise<Wishlist> {
    const wishlist: Omit<Wishlist, 'id'> = {
      userId,
      productIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const doc = await this.collection.add(wishlist);
    return { ...wishlist, id: doc.id };
  }

  async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    let wishlist = await this.getWishlist(userId);
    if (!wishlist) {
      wishlist = await this.createWishlist(userId);
    }

    if (!wishlist.productIds.includes(productId)) {
      await this.collection.doc(wishlist.id).update({
        productIds: [...wishlist.productIds, productId],
        updatedAt: new Date()
      });
      wishlist.productIds.push(productId);
      wishlist.updatedAt = new Date();
    }

    return wishlist;
  }

  async removeFromWishlist(userId: string, productId: string): Promise<Wishlist | null> {
    const wishlist = await this.getWishlist(userId);
    if (!wishlist) return null;

    const updatedProductIds = wishlist.productIds.filter(id => id !== productId);
    await this.collection.doc(wishlist.id).update({
      productIds: updatedProductIds,
      updatedAt: new Date()
    });

    wishlist.productIds = updatedProductIds;
    wishlist.updatedAt = new Date();
    return wishlist;
  }

  async clearWishlist(userId: string): Promise<void> {
    const wishlist = await this.getWishlist(userId);
    if (wishlist) {
      await this.collection.doc(wishlist.id).update({
        productIds: [],
        updatedAt: new Date()
      });
    }
  }
}
