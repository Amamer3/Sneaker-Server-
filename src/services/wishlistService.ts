import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Wishlist, WishlistItem, EnrichedWishlist } from '../models/Wishlist';
import * as productService from '../services/productService';
import { cacheKey, getCache, setCache, clearCache } from '../utils/cache';

export class WishlistService {
  private collection = FirestoreService.collection(COLLECTIONS.WISHLISTS);

  async getWishlist(userId: string): Promise<Wishlist | null> {
    try {
      // Try to get from cache
      const cacheKeyStr = cacheKey('wishlist', { userId });
      const cached = await getCache<Wishlist>(cacheKeyStr);
      if (cached) return cached;

      const doc = await this.collection.where('userId', '==', userId).limit(1).get();
      if (doc.empty) return null;

      const wishlist = doc.docs[0].data() as Wishlist;
      wishlist.id = doc.docs[0].id;

      // Cache the result
      await setCache(cacheKeyStr, wishlist);

      return wishlist;
    } catch (error) {
      console.error('Error getting wishlist:', error);
      throw new Error('Failed to get wishlist');
    }
  }

  async getEnrichedWishlist(userId: string): Promise<EnrichedWishlist | null> {
    try {
      const wishlist = await this.getWishlist(userId);
      if (!wishlist) return null;

      // Get product details in parallel
      const products = await Promise.all(
        wishlist.items.map(item => productService.getProductById(item.productId))
      );

      const enrichedWishlist: EnrichedWishlist = {
        ...wishlist,
        items: wishlist.items.map((item, index) => ({
          ...item,
          product: products[index]
        }))
      };

      return enrichedWishlist;
    } catch (error) {
      console.error('Error enriching wishlist:', error);
      throw new Error('Failed to get enriched wishlist');
    }
  }

  async createWishlist(userId: string): Promise<Wishlist> {
    try {
      const now = new Date();
      const wishlist: Omit<Wishlist, 'id'> = {
        userId,
        items: [],
        createdAt: now,
        updatedAt: now
      };

      const doc = await this.collection.add(wishlist);
      const created = { ...wishlist, id: doc.id };

      // Clear cache
      await clearCache(`wishlist:${userId}*`);

      return created;
    } catch (error) {
      console.error('Error creating wishlist:', error);
      throw new Error('Failed to create wishlist');
    }
  }

  async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    try {
      let wishlist = await this.getWishlist(userId);
      if (!wishlist) {
        wishlist = await this.createWishlist(userId);
      }

      // Check if product already in wishlist
      if (!wishlist.items.some(item => item.productId === productId)) {
        const now = new Date();
        const newItem: WishlistItem = {
          productId,
          addedAt: now
        };

        await this.collection.doc(wishlist.id).update({
          items: [...wishlist.items, newItem],
          updatedAt: now
        });

        wishlist.items.push(newItem);
        wishlist.updatedAt = now;

        // Clear cache
        await clearCache(`wishlist:${userId}*`);
      }

      return wishlist;
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      throw new Error('Failed to add item to wishlist');
    }
  }

  async removeFromWishlist(userId: string, productId: string): Promise<Wishlist | null> {
    try {
      const wishlist = await this.getWishlist(userId);
      if (!wishlist) return null;

      const updatedItems = wishlist.items.filter(item => item.productId !== productId);
      const now = new Date();

      await this.collection.doc(wishlist.id).update({
        items: updatedItems,
        updatedAt: now
      });

      wishlist.items = updatedItems;
      wishlist.updatedAt = now;

      // Clear cache
      await clearCache(`wishlist:${userId}*`);

      return wishlist;
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      throw new Error('Failed to remove item from wishlist');
    }
  }

  async clearWishlist(userId: string): Promise<void> {
    try {
      const wishlist = await this.getWishlist(userId);
      if (wishlist) {
        await this.collection.doc(wishlist.id).update({
          items: [],
          updatedAt: new Date()
        });

        // Clear cache
        await clearCache(`wishlist:${userId}*`);
      }
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      throw new Error('Failed to clear wishlist');
    }
  }
}
