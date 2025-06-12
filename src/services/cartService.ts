import { Cart, CartItem, StoredCartItem, GuestCart } from '../models/Cart';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Timestamp } from 'firebase-admin/firestore';

export class CartService {
  private collection = FirestoreService.collection(COLLECTIONS.CARTS);
  private productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);

  // Convert a guest cart to a stored cart
  async convertGuestCartToStoredCart(userId: string, guestCart: GuestCart): Promise<Cart> {
    const items = await Promise.all(
      guestCart.items.map(async (item) => {
        // Validate product and get current price
        const product = await this.productsCollection.doc(item.productId).get();
        if (!product.exists) {
          throw new Error(`Product ${item.productId} not found`);
        }
        const productData = product.data();
        return {
          ...item,
          price: productData?.price ?? 0, // Use current price from database or default to 0
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
      })
    );

    return this.createCart(userId, items);
  }

  private toFirestoreCart(cart: Partial<Cart>): Partial<Cart> {
    return {
      ...cart,
      createdAt: cart.createdAt instanceof Date ? Timestamp.fromDate(cart.createdAt) : cart.createdAt,
      updatedAt: cart.updatedAt instanceof Date ? Timestamp.fromDate(cart.updatedAt) : cart.updatedAt,
      items: cart.items?.map(item => ({
        ...item,
        createdAt: item.createdAt instanceof Date ? Timestamp.fromDate(item.createdAt) : item.createdAt,
        updatedAt: item.updatedAt instanceof Date ? Timestamp.fromDate(item.updatedAt) : item.updatedAt
      }))
    };
  }

  private fromFirestoreCart(cart: any): Cart {
    return {
      ...cart,
      createdAt: cart.createdAt?.toDate() || new Date(),
      updatedAt: cart.updatedAt?.toDate() || new Date(),
      items: (cart.items || []).map((item: any) => ({
        ...item,
        createdAt: item.createdAt?.toDate() || new Date(),
        updatedAt: item.updatedAt?.toDate() || new Date()
      }))
    };
  }

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
      const cartData = doc.data();
      
      return this.fromFirestoreCart({
        ...cartData,
        id: doc.id
      });
    } catch (error) {
      console.error('Error getting cart:', error);
      throw new Error('Failed to get cart');
    }
  }
  async addToCart(userId: string, productId: string, price: number, quantity: number = 1, size?: string): Promise<Cart> {
    try {
      let cart = await this.getCart(userId);
      const now = Timestamp.now();

      if (!cart) {
        return this.createCart(userId, [{
          productId,
          size,
          quantity,
          price,
          createdAt: now,
          updatedAt: now
        }]);
      }

      // Ensure cart has an id
      if (!cart.id) {
        throw new Error('Cart ID is missing');
      }

      const existingItemIndex = cart.items.findIndex(
        item => item.productId === productId && item.size === size
      );

      const updatedItems = [...cart.items];
      
      if (existingItemIndex > -1) {
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity,
          updatedAt: now
        };
      } else {
        const cartItem: CartItem = {
          productId,
          size,
          quantity,
          price,
          createdAt: now,
          updatedAt: now
        };
        updatedItems.push(cartItem);
      }

      const updates = {
        items: updatedItems,
        total: this.calculateTotal(updatedItems),
        updatedAt: now
      };

      const firestoreUpdates = this.toFirestoreCart(updates);
      await this.collection.doc(cart.id).update(firestoreUpdates as any);

      return this.fromFirestoreCart({
        ...cart,
        ...updates,
        id: cart.id
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw new Error('Failed to add item to cart');
    }
  }
  async updateCartItemQuantity(userId: string, productId: string, quantity: number): Promise<Cart | null> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) return null;

      const itemIndex = cart.items.findIndex(item => item.productId === productId);
      if (itemIndex === -1) return null;

      const now = Timestamp.now();
      const updatedItems = [...cart.items];

      if (quantity <= 0) {
        updatedItems.splice(itemIndex, 1);
      } else {
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          quantity,
          updatedAt: now
        };
      }

      const updates = {
        items: updatedItems,
        total: this.calculateTotal(updatedItems),
        updatedAt: now
      };

      const firestoreUpdates = this.toFirestoreCart(updates);
      await this.collection.doc(cart.id).update(firestoreUpdates);

      return this.fromFirestoreCart({
        ...cart,
        ...updates,
        id: cart.id
      });
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      throw new Error('Failed to update cart item quantity');
    }
  }
  async removeFromCart(userId: string, productId: string): Promise<Cart | null> {
    return this.updateCartItemQuantity(userId, productId, 0);
  }

  async clearCart(userId: string): Promise<void> {
    try {
      const cart = await this.getCart(userId);
      if (cart) {
        const updates = {
          items: [],
          total: 0,
          updatedAt: Timestamp.now()
        };
        const firestoreUpdates = this.toFirestoreCart(updates);
        await this.collection.doc(cart.id).update(firestoreUpdates);
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw new Error('Failed to clear cart');
    }
  }  async createCart(userId: string, items: CartItem[]): Promise<Cart> {
    try {
      const now = Timestamp.now();
      const cartData = {
        userId,
        items: items.map(item => ({
          ...item,
          createdAt: now,
          updatedAt: now
        })),
        total: this.calculateTotal(items),
        createdAt: now,
        updatedAt: now
      };

      const firestoreCart = this.toFirestoreCart(cartData);
      const docRef = await this.collection.add(firestoreCart);
      const newCart = await docRef.get();
      
      if (!newCart.exists) {
        throw new Error('Failed to create cart');
      }
      
      return this.fromFirestoreCart({
        ...newCart.data(),
        id: newCart.id
      });
    } catch (error) {
      console.error('Error creating cart:', error);
      throw new Error('Failed to create cart');
    }
  }

  async updateCart(userId: string, items: CartItem[]): Promise<Cart> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        return this.createCart(userId, items);
      }

      const now = Timestamp.now();
      const updatedCart: Partial<Cart> = {
        items: items.map(item => ({
          ...item,
          createdAt: item.createdAt || now,
          updatedAt: now
        })),
        total: this.calculateTotal(items),
        updatedAt: now
      };

      const firestoreUpdates = this.toFirestoreCart(updatedCart);
      await this.collection.doc(cart.id).update(firestoreUpdates);
      
      return this.fromFirestoreCart({
        ...cart,
        ...updatedCart,
        id: cart.id
      });
    } catch (error) {
      console.error('Error updating cart:', error);
      throw new Error('Failed to update cart');
    }
  }
}
