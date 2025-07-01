import { admin, FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { Cart, StoredCart } from '../models/Cart';
import { Timestamp } from 'firebase-admin/firestore';

interface Coupon {
  id?: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  userUsageLimit?: number;
  description?: string;
  termsAndConditions?: string;
  excludedProducts?: string[];
  excludedCategories?: string[];
}

export class CouponService {
  private collection = FirestoreService.collection(COLLECTIONS.COUPONS);

  // Get all coupons
  async getAllCoupons(): Promise<Coupon[]> {
    try {
      console.log('Fetching coupons from collection:', COLLECTIONS.COUPONS);
      const snapshot = await this.collection.get();
      console.log('Snapshot size:', snapshot.size);
      console.log('Snapshot empty:', snapshot.empty);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        let startDate: Date | undefined;
        let endDate: Date | undefined;
        try {
          startDate = data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined);
        } catch {
          startDate = undefined;
        }
        try {
          endDate = data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined);
        } catch {
          endDate = undefined;
        }
        return {
          ...data,
          id: doc.id,
          startDate,
          endDate
        } as Coupon;
      });
    } catch (error) {
      console.error('Error getting coupons:', error);
      throw new Error('Failed to get coupons');
    }
  }

  // Get coupon stats for a date range
  async getCouponStats(startDate: Date, endDate: Date): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    totalUsage: number;
    totalDiscount: number;
  }> {
    try {
      const coupons = await this.getAllCoupons();
      const now = new Date();

      const activeCoupons = coupons.filter(coupon => 
        coupon.isActive && 
        coupon.startDate <= now && 
        coupon.endDate >= now
      );

      return {
        totalCoupons: coupons.length,
        activeCoupons: activeCoupons.length,
        totalUsage: coupons.reduce((sum, coupon) => sum + (coupon.usageCount || 0), 0),
        totalDiscount: 0 // This would need order data to calculate
      };
    } catch (error) {
      console.error('Error getting coupon stats:', error);
      throw new Error('Failed to get coupon statistics');
    }
  }

  // Create a new coupon
  async createCoupon(data: Omit<Coupon, 'id' | 'usageCount'>, userId: string): Promise<Coupon> {
    try {
      const now = new Date();
      const couponData = {
        ...data,
        code: data.code.toUpperCase(), // Always store code as uppercase
        usageCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId
      };

      const docRef = await this.collection.add(couponData);
      const doc = await docRef.get();

      return {
        ...doc.data(),
        id: doc.id,
        startDate: doc.data()?.startDate.toDate(),
        endDate: doc.data()?.endDate.toDate()
      } as Coupon;
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw new Error('Failed to create coupon');
    }
  }

  // Update a coupon
  async updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon> {
    try {
      const updates = {
        ...data,
        updatedAt: Timestamp.now()
      };

      await this.collection.doc(id).update(updates);
      const doc = await this.collection.doc(id).get();

      return {
        ...doc.data(),
        id: doc.id,
        startDate: doc.data()?.startDate.toDate(),
        endDate: doc.data()?.endDate.toDate()
      } as Coupon;
    } catch (error) {
      console.error('Error updating coupon:', error);
      throw new Error('Failed to update coupon');
    }
  }

  // Delete a coupon
  async deleteCoupon(id: string): Promise<void> {
    try {
      await this.collection.doc(id).delete();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      throw new Error('Failed to delete coupon');
    }
  }

  // Validate a coupon with full validation
  async validateCouponFull(
    code: string, 
    userId: string, 
    cart: StoredCart | null, 
    cartTotal: number
  ): Promise<{
    isValid: boolean;
    error?: string;
    coupon?: Coupon;
  }> {
    try {
      // Always compare codes in uppercase
      const snapshot = await this.collection
        .where('code', '==', code.toUpperCase())
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { isValid: false, error: 'Coupon not found' };
      }

      const coupon = {
        ...snapshot.docs[0].data(),
        id: snapshot.docs[0].id,
        startDate: snapshot.docs[0].data().startDate.toDate(),
        endDate: snapshot.docs[0].data().endDate.toDate()
      } as Coupon;

      const now = new Date();

      // Check if coupon is within valid date range
      if (now < coupon.startDate || now > coupon.endDate) {
        return { isValid: false, error: 'Coupon has expired' };
      }

      // Check minimum purchase requirement
      if (coupon.minPurchase && cartTotal < coupon.minPurchase) {
        return { 
          isValid: false, 
          error: `Minimum purchase amount of $${coupon.minPurchase} required` 
        };
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return { isValid: false, error: 'Coupon usage limit reached' };
      }

      // Check user-specific usage limit
      if (coupon.userUsageLimit) {
        const userUsage = await this.getUserCouponUsage(userId, code.toUpperCase());
        if (userUsage >= coupon.userUsageLimit) {
          return { 
            isValid: false, 
            error: `You've reached the maximum uses (${coupon.userUsageLimit}) for this coupon` 
          };
        }
      }

      // Check excluded products if cart is provided
      if (cart && coupon.excludedProducts?.length) {
        const hasExcludedProduct = cart.items.some(item => 
          coupon.excludedProducts?.includes(item.productId)
        );
        if (hasExcludedProduct) {
          return { 
            isValid: false, 
            error: 'Coupon cannot be applied to some items in your cart' 
          };
        }
      }

      return { isValid: true, coupon };
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw new Error('Failed to validate coupon');
    }
  }

  /**
   * Applies a coupon to the given cart and total, returning the discount, final amount, and coupon details.
   * @param couponCode The coupon code to apply
   * @param userId The user ID (can be empty for guest)
   * @param arg2 Reserved for future use or guest session ID
   * @param cart The cart object
   * @param total The cart total before discount
   * @returns An object with discountAmount, finalAmount, and coupon
   */
  async applyCoupon(
    couponCode: string,
    userId: string,
    arg2: string,
    cart: StoredCart,
    total: number
  ): Promise<{ discountAmount: number; finalAmount: number; coupon: Coupon | null }> {
    // Validate coupon
    const validation = await this.validateCouponFull(couponCode, userId, cart, total);
    if (!validation.isValid || !validation.coupon) {
      return { discountAmount: 0, finalAmount: total, coupon: null };
    }
    const coupon = validation.coupon;
    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (total * coupon.value) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.value;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }
    // Ensure discount does not exceed total
    if (discountAmount > total) {
      discountAmount = total;
    }
    const finalAmount = total - discountAmount;
    return { discountAmount, finalAmount, coupon };
  }

  // Get user's usage count for a specific coupon
  private async getUserCouponUsage(userId: string, code: string): Promise<number> {
    try {
      const snapshot = await FirestoreService.collection(COLLECTIONS.COUPON_USAGE)
        .where('userId', '==', userId)
        .where('couponCode', '==', code)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error('Error getting user coupon usage:', error);
      return 0;
    }
  }

  // Simple validateCoupon method for cart service
  async validateCoupon(code: string): Promise<Coupon> {
    try {
      const snapshot = await this.collection
        .where('code', '==', code.toUpperCase())
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Coupon not found');
      }

      const coupon = {
        ...snapshot.docs[0].data(),
        id: snapshot.docs[0].id,
        startDate: snapshot.docs[0].data().startDate.toDate(),
        endDate: snapshot.docs[0].data().endDate.toDate()
      } as Coupon;

      const now = new Date();
      if (now < coupon.startDate || now > coupon.endDate) {
        throw new Error('Coupon has expired');
      }

      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new Error('Coupon usage limit reached');
      }

      return coupon;
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw error;
    }
  }

  // Calculate discount amount
  calculateDiscount(coupon: Coupon, total: number): number {
    let discountAmount = 0;
    
    if (coupon.minPurchase && total < coupon.minPurchase) {
      throw new Error(`Minimum purchase amount of $${coupon.minPurchase} required`);
    }

    if (coupon.type === 'percentage') {
      discountAmount = (total * coupon.value) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.value;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }

    // Ensure discount does not exceed total
    if (discountAmount > total) {
      discountAmount = total;
    }

    return discountAmount;
  }
}