import { Cart, CartItem } from '../models/Cart';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';

export class CartService {
  private collection = FirestoreService.collection(COLLECTIONS.CARTS);

  private calculateTotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  async getCart(userId: string): Promise<Cart | null> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { ...doc.data(), id: doc.id } as Cart;
    } catch (error) {
      console.error('Error getting cart:', error);
      throw new Error('Failed to get cart');
    }
  }

  async addToCart(userId: string, productId: string, price: number, quantity: number = 1, size?: string): Promise<Cart> {
    try {
      let cart = await this.getCart(userId);
      const now = new Date();

      if (!cart) {
        const newCart: Omit<Cart, 'id'> = {
          userId,
          items: [],
          total: 0,
          createdAt: now,
          updatedAt: now
        };
        cart = await FirestoreService.create<Cart>(COLLECTIONS.CARTS, newCart);
      }

      const existingItemIndex = cart.items.findIndex(
        item => item.productId === productId && item.size === size
      );

      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += quantity;
        cart.items[existingItemIndex].updatedAt = now;
      } else {
        const cartItem: CartItem = {
          id: FirestoreService.collection(COLLECTIONS.CARTS).doc().id,
          productId,
          size,
          quantity,
          price,
          createdAt: now,
          updatedAt: now
        };
        cart.items.push(cartItem);
      }

      cart.total = this.calculateTotal(cart.items);
      cart.updatedAt = now;

      await FirestoreService.update<Cart>(COLLECTIONS.CARTS, cart.id, {
        items: cart.items,
        total: cart.total,
        updatedAt: now
      });

      return cart;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw new Error('Failed to add item to cart');
    }
  }

  async updateCartItemQuantity(userId: string, itemId: string, quantity: number): Promise<Cart | null> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) return null;

      const itemIndex = cart.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) return null;

      const now = new Date();

      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].updatedAt = now;
      }

      cart.total = this.calculateTotal(cart.items);
      cart.updatedAt = now;

      await FirestoreService.update<Cart>(COLLECTIONS.CARTS, cart.id, {
        items: cart.items,
        total: cart.total,
        updatedAt: now
      });

      return cart;
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      throw new Error('Failed to update cart item quantity');
    }
  }

  async removeFromCart(userId: string, itemId: string): Promise<Cart | null> {
    return this.updateCartItemQuantity(userId, itemId, 0);
  }

  async clearCart(userId: string): Promise<void> {
    try {
      const cart = await this.getCart(userId);
      if (cart) {
        const now = new Date();
        await FirestoreService.update<Cart>(COLLECTIONS.CARTS, cart.id, {
          items: [],
          total: 0,
          updatedAt: now
        });
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw new Error('Failed to clear cart');
    }
  }
}
