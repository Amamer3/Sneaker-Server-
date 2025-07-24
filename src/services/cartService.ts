import { StoredCart } from '../models/Cart';
import { admin, FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { Timestamp } from 'firebase-admin/firestore';

import { Cart, GuestCart, CartItem, StoredCartItem } from '../models/Cart';
import { Product } from '../models/Product';
import { CouponService } from './couponService';

export class CartService {
  private collection = FirestoreService.collection(COLLECTIONS.CARTS);
  private productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);
  private couponService = new CouponService();


  // Convert a guest cart to a stored cart
  async convertGuestCartToStoredCart(userId: string, guestCart: GuestCart): Promise<Cart> {
    // First check if user already has a cart
    const existingCart = await this.getCart(userId);
    
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
          price: productData?.price ?? 0, // Use current price from database
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
      })
    );

    if (existingCart) {
      // Merge guest cart items with existing cart
      return this.updateCart(userId, [...existingCart.items, ...items]);
    }

    // Create new cart if user doesn't have one
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
    const convertTimestamp = (timestamp: any): Date => {
      if (!timestamp) return new Date();
      if (timestamp instanceof Date) return timestamp;
      if (typeof timestamp.toDate === 'function') return timestamp.toDate();
      if (typeof timestamp === 'string') return new Date(timestamp);
      if (typeof timestamp === 'number') return new Date(timestamp);
      return new Date();
    };

    return {
      ...cart,
      createdAt: convertTimestamp(cart.createdAt),
      updatedAt: convertTimestamp(cart.updatedAt),
      items: (cart.items || []).map((item: any) => ({
        ...item,
        createdAt: convertTimestamp(item.createdAt),
        updatedAt: convertTimestamp(item.updatedAt)
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
      // First verify that the product exists
      const productDoc = await this.productsCollection.doc(productId).get();
      if (!productDoc.exists) {
        throw new Error(`Product ${productId} not found`);
      }
      const productData = productDoc.data();
      // Use the current price from the database to ensure price accuracy
      const currentPrice = productData?.price ?? price;

      let cart = await this.getCart(userId);
      const now = Timestamp.now();

      if (!cart) {
        return this.createCart(userId, [{
          productId,
          size,
          quantity,
          price: currentPrice,
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
          price: currentPrice, // Update to current price
          updatedAt: now
        };
      } else {
        const cartItem: CartItem = {
          productId,
          size,
          quantity,
          price: currentPrice,
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
  async updateCartItemQuantity(userId: string, productId: string, quantity: number, size?: string): Promise<Cart | null> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) return null;

      // Find item by productId and size (if provided)
      const itemIndex = cart.items.findIndex(item => 
        item.productId === productId && 
        (size === undefined || item.size === size)
      );
      
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
      await this.collection.doc(cart.id!).update(firestoreUpdates as any);

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
  async removeFromCart(userId: string, productId: string, size?: string): Promise<Cart | null> {
    return this.updateCartItemQuantity(userId, productId, 0, size);
  }

  async clearCart(userId: string): Promise<void> {
    try {
      const cart = await this.getCart(userId);
      if (cart) {
        // Delete the cart document completely from the database
        await this.collection.doc(cart.id).delete();
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

  // Validate cart items against current inventory
  async validateCartInventory(userId: string): Promise<{
    valid: boolean;
    issues: Array<{
      productId: string;
      issue: 'out_of_stock' | 'insufficient_stock' | 'price_changed';
      availableStock?: number;
      currentPrice?: number;
    }>;
  }> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        return { valid: true, issues: [] };
      }

      const issues: any[] = [];

      for (const item of cart.items) {
        // Check stock availability
        const productDoc = await this.productsCollection.doc(item.productId).get();
        if (!productDoc.exists) {
          issues.push({
            productId: item.productId,
            issue: 'out_of_stock',
            availableStock: 0
          });
          continue;
        }

        const productData = productDoc.data();
        const availableStock = productData?.stock || 0;
        const inStock = productData?.inStock || false;

        // Check if product is out of stock
        if (!inStock || availableStock === 0) {
          issues.push({
            productId: item.productId,
            issue: 'out_of_stock',
            availableStock: 0
          });
        }
        // Check if requested quantity exceeds available stock
        else if (item.quantity > availableStock) {
          issues.push({
            productId: item.productId,
            issue: 'insufficient_stock',
            availableStock
          });
        }

        // Check price changes
        const currentPrice = productData?.price;
        if (currentPrice && Math.abs(currentPrice - item.price) > 0.01) {
          issues.push({
            productId: item.productId,
            issue: 'price_changed',
            currentPrice
          });
        }
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('Error validating cart inventory:', error);
      throw new Error('Failed to validate cart inventory');
    }
  }

  // Bulk stock check for multiple items (used during checkout)
  async bulkStockCheck(items: Array<{ productId: string; quantity: number }>): Promise<{
    valid: boolean;
    issues: Array<{
      productId: string;
      issue: 'out_of_stock' | 'insufficient_stock' | 'product_not_found';
      availableStock?: number;
      requestedQuantity: number;
    }>;
  }> {
    try {
      const issues: any[] = [];

      for (const item of items) {
        const productDoc = await this.productsCollection.doc(item.productId).get();
        
        if (!productDoc.exists) {
          issues.push({
            productId: item.productId,
            issue: 'product_not_found',
            requestedQuantity: item.quantity
          });
          continue;
        }

        const productData = productDoc.data();
        const availableStock = productData?.stock || 0;
        const inStock = productData?.inStock || false;

        // Check if product is out of stock
        if (!inStock || availableStock === 0) {
          issues.push({
            productId: item.productId,
            issue: 'out_of_stock',
            availableStock: 0,
            requestedQuantity: item.quantity
          });
        }
        // Check if requested quantity exceeds available stock
        else if (item.quantity > availableStock) {
          issues.push({
            productId: item.productId,
            issue: 'insufficient_stock',
            availableStock,
            requestedQuantity: item.quantity
          });
        }
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('Error performing bulk stock check:', error);
      throw new Error('Stock validation failed: bulkStockCheck is not defined');
    }
  }

  // Apply coupon to cart
  async applyCouponToCart(userId: string, couponCode: string): Promise<{
    cart: Cart;
    discount: {
      amount: number;
      percentage?: number;
      description: string;
    };
  }> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      // Pass cart as StoredCart for type safety
      const validation = await this.couponService.validateCouponFull(couponCode, userId, cart as StoredCart, cart.total);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid or expired coupon');
      }

      // Use await and remove unnecessary type assertions and runtime checks
      const discountResult = await this.couponService.applyCoupon(
        couponCode,
        userId,
        '', // orderId - empty for cart application
        cart as StoredCart,
        cart.total
      );

      const { discountAmount, finalAmount, coupon } = discountResult;

      // Update cart with coupon information
      const now = Timestamp.now();
      const updates = {
        couponCode,
        couponDiscount: discountAmount,
        total: finalAmount,
        updatedAt: now,
      };

      await this.collection.doc(cart.id).update(updates);

      const updatedCart = this.fromFirestoreCart({
        ...cart,
        ...updates,
        id: cart.id
      });

      return {
        cart: updatedCart,
        discount: {
          amount: discountAmount,
          percentage: coupon?.type === 'percentage' ? coupon.value : undefined,
          description: `Coupon ${couponCode} applied`
        },
      };
    } catch (error) {
      console.error('Error applying coupon to cart:', error);
      throw new Error('Failed to apply coupon to cart');
    }
  }

  // Remove coupon from cart
  async removeCouponFromCart(userId: string): Promise<Cart> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      const now = Timestamp.now();
      const updates = {
        couponCode: admin.firestore.FieldValue.delete(),
        couponDiscount: admin.firestore.FieldValue.delete(),
        total: this.calculateTotal(cart.items),
        updatedAt: now
      };

      await this.collection.doc(cart.id).update(updates);

      return this.fromFirestoreCart({
        ...cart,
        total: this.calculateTotal(cart.items),
        updatedAt: now.toDate(),
        id: cart.id
      });
    } catch (error) {
      console.error('Error removing coupon from cart:', error);
      throw new Error('Failed to remove coupon from cart');
    }
  }

  // Get cart summary with shipping and tax calculations
  async getCartSummary(userId: string, shippingAddress?: any): Promise<{
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    itemCount: number;
  }> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        return {
          subtotal: 0,
          discount: 0,
          shipping: 0,
          tax: 0,
          total: 0,
          itemCount: 0
        };
      }

      const subtotal = this.calculateTotal(cart.items);
      const discount = (cart as any).discount || 0;
      const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      
      // Calculate shipping (simplified logic)
      let shipping = 0;
      if (subtotal > 0 && subtotal < 100) {
        shipping = 10; // $10 shipping for orders under $100
      }

      // Calculate tax (simplified - 8.5% tax rate)
      const taxableAmount = subtotal - discount;
      const tax = Math.round(taxableAmount * 0.085 * 100) / 100;

      const total = subtotal - discount + shipping + tax;

      return {
        subtotal,
        discount,
        shipping,
        tax,
        total,
        itemCount
      };
    } catch (error) {
      console.error('Error getting cart summary:', error);
      throw new Error('Failed to get cart summary');
    }
  }

  // Save item for later (move from cart to saved items)
  async saveForLater(userId: string, productId: string): Promise<Cart> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      const itemIndex = cart.items.findIndex(item => item.productId === productId);
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      const savedItem = cart.items[itemIndex];
      const updatedItems = cart.items.filter((_, index) => index !== itemIndex);
      
      const now = Timestamp.now();
      const updates = {
        items: updatedItems,
        total: this.calculateTotal(updatedItems),
        savedItems: [...((cart as any).savedItems || []), {
          ...savedItem,
          savedAt: now
        }],
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
      console.error('Error saving item for later:', error);
      throw new Error('Failed to save item for later');
    }
  }

  // Move saved item back to cart
  async moveToCart(userId: string, productId: string): Promise<Cart> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      const savedItems = (cart as any).savedItems || [];
      const itemIndex = savedItems.findIndex((item: any) => item.productId === productId);
      if (itemIndex === -1) {
        throw new Error('Saved item not found');
      }

      const savedItem = savedItems[itemIndex];
      const updatedSavedItems = savedItems.filter((_: any, index: number) => index !== itemIndex);
      
      // Check if item already exists in cart
      const existingCartItemIndex = cart.items.findIndex(
        item => item.productId === productId && item.size === savedItem.size
      );

      let updatedCartItems = [...cart.items];
      const now = Timestamp.now();

      if (existingCartItemIndex > -1) {
        // Merge quantities
        updatedCartItems[existingCartItemIndex] = {
          ...updatedCartItems[existingCartItemIndex],
          quantity: updatedCartItems[existingCartItemIndex].quantity + savedItem.quantity,
          updatedAt: now
        };
      } else {
        // Add as new item
        updatedCartItems.push({
          ...savedItem,
          updatedAt: now
        });
      }

      const updates = {
        items: updatedCartItems,
        total: this.calculateTotal(updatedCartItems),
        savedItems: updatedSavedItems,
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
      console.error('Error moving item to cart:', error);
      throw new Error('Failed to move item to cart');
    }
  }

  // Get abandoned carts (for marketing purposes)
  async getAbandonedCarts(daysOld: number = 1): Promise<Cart[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const snapshot = await this.collection
        .where('updatedAt', '<', Timestamp.fromDate(cutoffDate))
        .where('items', '!=', [])
        .limit(100)
        .get();

      return snapshot.docs.map(doc => this.fromFirestoreCart({
        ...doc.data(),
        id: doc.id
      }));
    } catch (error) {
      console.error('Error getting abandoned carts:', error);
      throw new Error('Failed to get abandoned carts');
    }
  }

  // Get cart analytics
  async getCartAnalytics(startDate: Date, endDate: Date): Promise<{
    totalCarts: number;
    averageCartValue: number;
    abandonmentRate: number;
    topProducts: Array<{ productId: string; addedCount: number }>;
  }> {
    try {
      const snapshot = await this.collection
        .where('createdAt', '>=', Timestamp.fromDate(startDate))
        .where('createdAt', '<=', Timestamp.fromDate(endDate))
        .get();

      const carts = snapshot.docs.map(doc => this.fromFirestoreCart({
        ...doc.data(),
        id: doc.id
      }));

      const totalCarts = carts.length;
      const cartsWithItems = carts.filter(cart => cart.items.length > 0);
      const averageCartValue = cartsWithItems.length > 0 
        ? cartsWithItems.reduce((sum, cart) => sum + cart.total, 0) / cartsWithItems.length 
        : 0;

      // Calculate abandonment rate (carts with items but no recent orders)
      const abandonedCarts = await this.getAbandonedCarts(7);
      const abandonmentRate = totalCarts > 0 ? (abandonedCarts.length / totalCarts) * 100 : 0;

      // Get top products added to cart
      const productCounts: Record<string, number> = {};
      carts.forEach(cart => {
        cart.items.forEach(item => {
          productCounts[item.productId] = (productCounts[item.productId] || 0) + 1;
        });
      });

      const topProducts = Object.entries(productCounts)
        .map(([productId, addedCount]) => ({ productId, addedCount }))
        .sort((a, b) => b.addedCount - a.addedCount)
        .slice(0, 10);

      return {
        totalCarts,
        averageCartValue,
        abandonmentRate,
        topProducts
      };
    } catch (error) {
      console.error('Error getting cart analytics:', error);
      throw new Error('Failed to get cart analytics');
    }
  }

  async applyCoupon(userId: string, couponCode: string): Promise<{ cart: Cart; discount: number }> {
    try {
      // Validate coupon
      const coupon = await this.couponService.validateCoupon(couponCode);
      
      // Get current cart
      const cart = await this.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      // Calculate discount
      const discount = this.couponService.calculateDiscount(coupon, cart.total);
      
      // Update cart with coupon
      const updatedCart = {
        ...cart,
        couponCode: couponCode,
        discount: discount,
        total: cart.total - discount,
        updatedAt: Timestamp.now()
      };

      await this.collection.doc(userId).set(this.toFirestoreCart(updatedCart));
      
      return {
        cart: this.fromFirestoreCart(updatedCart),
        discount
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      throw error;
    }
  }

  async removeCoupon(userId: string): Promise<Cart> {
    try {
      const cart = await this.getCart(userId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      // Recalculate total without discount
      const originalTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const updatedCart = {
        ...cart,
        couponCode: undefined,
        discount: 0,
        total: originalTotal,
        updatedAt: Timestamp.now()
      };

      await this.collection.doc(userId).set(this.toFirestoreCart(updatedCart));
      
      return this.fromFirestoreCart(updatedCart);
    } catch (error) {
      console.error('Error removing coupon:', error);
      throw error;
    }
  }
}
