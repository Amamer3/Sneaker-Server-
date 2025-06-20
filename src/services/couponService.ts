import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { Coupon, CouponUsage, CreateCouponInput, CouponType, CouponStatus } from '../models/Coupon';
import { Cart } from '../models/Cart';
import { Order } from '../models/Order';
import { admin } from '../config/firebase';

const couponsCollection = FirestoreService.collection('coupons');
const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);
const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);

export interface CouponValidationResult {
  isValid: boolean;
  error?: string;
  discountAmount?: number;
  finalAmount?: number;
}

export interface ApplyCouponResult {
  success: boolean;
  discountAmount: number;
  finalAmount: number;
  coupon: Coupon;
  error?: string;
}

export class CouponService {
  // Create a new coupon
  async createCoupon(couponData: CreateCouponInput, createdBy: string): Promise<Coupon> {
    try {
      // Check if coupon code already exists
      const existingCoupon = await this.getCouponByCode(couponData.code);
      if (existingCoupon) {
        throw new Error('Coupon code already exists');
      }

      const now = new Date();
      const coupon: Omit<Coupon, 'id'> = {
        ...couponData,
        currentUsage: 0,
        usageHistory: [],
        isActive: couponData.isActive ?? true,
        isPublic: couponData.isPublic ?? true,
        stackable: couponData.stackable ?? false,
        firstTimeUserOnly: couponData.firstTimeUserOnly ?? false,
        createdBy,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await couponsCollection.add(coupon);
      return { ...coupon, id: docRef.id };
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw new Error('Failed to create coupon');
    }
  }

  // Get coupon by code
  async getCouponByCode(code: string): Promise<Coupon | null> {
    try {
      const snapshot = await couponsCollection
        .where('code', '==', code.toUpperCase())
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        validFrom: doc.data().validFrom?.toDate(),
        validUntil: doc.data().validUntil?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      } as Coupon;
    } catch (error) {
      console.error('Error getting coupon by code:', error);
      throw new Error('Failed to get coupon');
    }
  }

  // Validate coupon
  async validateCoupon(
    code: string, 
    userId: string, 
    cart: Cart,
    orderTotal: number
  ): Promise<CouponValidationResult> {
    try {
      const coupon = await this.getCouponByCode(code);
      
      if (!coupon) {
        return { isValid: false, error: 'Coupon not found' };
      }

      // Check if coupon is active
      if (!coupon.isActive) {
        return { isValid: false, error: 'Coupon is not active' };
      }

      // Check validity dates
      const now = new Date();
      if (now < coupon.validFrom) {
        return { isValid: false, error: 'Coupon is not yet valid' };
      }
      if (now > coupon.validUntil) {
        return { isValid: false, error: 'Coupon has expired' };
      }

      // Check usage limits
      if (coupon.usageLimit && coupon.currentUsage >= coupon.usageLimit) {
        return { isValid: false, error: 'Coupon usage limit reached' };
      }

      // Check per-user usage limit
      if (coupon.usageLimitPerUser) {
        const userUsage = coupon.usageHistory.filter(usage => usage.userId === userId).length;
        if (userUsage >= coupon.usageLimitPerUser) {
          return { isValid: false, error: 'User usage limit reached for this coupon' };
        }
      }

      // Check first-time user only
      if (coupon.firstTimeUserOnly) {
        const userDoc = await usersCollection.doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.analytics?.totalOrders > 0) {
            return { isValid: false, error: 'Coupon is only valid for first-time users' };
          }
        }
      }

      // Check minimum order amount
      if (coupon.minimumOrderAmount && orderTotal < coupon.minimumOrderAmount) {
        return { 
          isValid: false, 
          error: `Minimum order amount of $${coupon.minimumOrderAmount} required` 
        };
      }

      // Check applicable products/categories
      if (coupon.applicableProducts?.length || coupon.applicableCategories?.length) {
        const hasApplicableItems = await this.checkApplicableItems(cart, coupon);
        if (!hasApplicableItems) {
          return { isValid: false, error: 'Coupon not applicable to items in cart' };
        }
      }

      // Check excluded products/categories
      if (coupon.excludedProducts?.length || coupon.excludedCategories?.length) {
        const hasExcludedItems = await this.checkExcludedItems(cart, coupon);
        if (hasExcludedItems) {
          return { isValid: false, error: 'Cart contains items excluded from this coupon' };
        }
      }

      // Calculate discount
      const discountAmount = await this.calculateDiscount(coupon, cart, orderTotal);
      const finalAmount = Math.max(0, orderTotal - discountAmount);

      return {
        isValid: true,
        discountAmount,
        finalAmount
      };
    } catch (error) {
      console.error('Error validating coupon:', error);
      return { isValid: false, error: 'Failed to validate coupon' };
    }
  }

  // Apply coupon to order
  async applyCoupon(
    code: string,
    userId: string,
    orderId: string,
    cart: Cart,
    orderTotal: number
  ): Promise<ApplyCouponResult> {
    try {
      const validation = await this.validateCoupon(code, userId, cart, orderTotal);
      
      if (!validation.isValid) {
        return {
          success: false,
          discountAmount: 0,
          finalAmount: orderTotal,
          coupon: null as any,
          error: validation.error
        };
      }

      const coupon = await this.getCouponByCode(code);
      if (!coupon) {
        throw new Error('Coupon not found');
      }

      // Record usage
      const usage: CouponUsage = {
        userId,
        orderId,
        usedAt: new Date(),
        discountAmount: validation.discountAmount!
      };

      // Update coupon
      await couponsCollection.doc(coupon.id).update({
        currentUsage: coupon.currentUsage + 1,
        usageHistory: admin.firestore.FieldValue.arrayUnion(usage),
        updatedAt: new Date()
      });

      return {
        success: true,
        discountAmount: validation.discountAmount!,
        finalAmount: validation.finalAmount!,
        coupon
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      return {
        success: false,
        discountAmount: 0,
        finalAmount: orderTotal,
        coupon: null as any,
        error: 'Failed to apply coupon'
      };
    }
  }

  // Calculate discount amount
  private async calculateDiscount(coupon: Coupon, cart: Cart, orderTotal: number): Promise<number> {
    let discountAmount = 0;

    switch (coupon.type) {
      case 'percentage':
        discountAmount = (orderTotal * coupon.value) / 100;
        break;
      
      case 'fixed':
        discountAmount = coupon.value;
        break;
      
      case 'free_shipping':
        // Assuming shipping cost is calculated elsewhere
        discountAmount = 0; // This would be the shipping cost
        break;
      
      case 'buy_x_get_y':
        // Complex logic for buy X get Y offers
        discountAmount = await this.calculateBuyXGetYDiscount(coupon, cart);
        break;
    }

    // Apply maximum discount limit
    if (coupon.maximumDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maximumDiscountAmount);
    }

    return Math.min(discountAmount, orderTotal);
  }

  // Check if cart has applicable items
  private async checkApplicableItems(cart: Cart, coupon: Coupon): Promise<boolean> {
    if (!coupon.applicableProducts?.length && !coupon.applicableCategories?.length) {
      return true;
    }

    for (const item of cart.items) {
      if (coupon.applicableProducts?.includes(item.productId)) {
        return true;
      }

      if (coupon.applicableCategories?.length) {
        const productDoc = await productsCollection.doc(item.productId).get();
        if (productDoc.exists) {
          const product = productDoc.data();
          if (coupon.applicableCategories.includes(product?.category)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // Check if cart has excluded items
  private async checkExcludedItems(cart: Cart, coupon: Coupon): Promise<boolean> {
    for (const item of cart.items) {
      if (coupon.excludedProducts?.includes(item.productId)) {
        return true;
      }

      if (coupon.excludedCategories?.length) {
        const productDoc = await productsCollection.doc(item.productId).get();
        if (productDoc.exists) {
          const product = productDoc.data();
          if (coupon.excludedCategories.includes(product?.category)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // Calculate Buy X Get Y discount
  private async calculateBuyXGetYDiscount(coupon: Coupon, cart: Cart): Promise<number> {
    // This is a simplified implementation
    // In a real scenario, you'd need more complex logic based on the specific offer
    return 0;
  }

  // Get all active coupons
  async getActiveCoupons(isPublic: boolean = true): Promise<Coupon[]> {
    try {
      let query = couponsCollection
        .where('isActive', '==', true)
        .where('validUntil', '>', new Date());

      if (isPublic) {
        query = query.where('isPublic', '==', true);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        validFrom: doc.data().validFrom?.toDate(),
        validUntil: doc.data().validUntil?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Coupon[];
    } catch (error) {
      console.error('Error getting active coupons:', error);
      throw new Error('Failed to get active coupons');
    }
  }

  // Update coupon
  async updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<Coupon> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await couponsCollection.doc(couponId).update(updateData);
      
      const updatedDoc = await couponsCollection.doc(couponId).get();
      return {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        validFrom: updatedDoc.data()?.validFrom?.toDate(),
        validUntil: updatedDoc.data()?.validUntil?.toDate(),
        createdAt: updatedDoc.data()?.createdAt?.toDate(),
        updatedAt: updatedDoc.data()?.updatedAt?.toDate()
      } as Coupon;
    } catch (error) {
      console.error('Error updating coupon:', error);
      throw new Error('Failed to update coupon');
    }
  }

  // Delete coupon
  async deleteCoupon(couponId: string): Promise<void> {
    try {
      await couponsCollection.doc(couponId).delete();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      throw new Error('Failed to delete coupon');
    }
  }
}

export const couponService = new CouponService();