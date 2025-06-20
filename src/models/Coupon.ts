export interface CouponUsage {
  userId: string;
  orderId: string;
  usedAt: Date;
  discountAmount: number;
}

export type CouponType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
export type CouponStatus = 'active' | 'inactive' | 'expired' | 'used_up';

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
  value: number; // Percentage (0-100) or fixed amount
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  usageLimit?: number; // Total usage limit
  usageLimitPerUser?: number;
  currentUsage: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  isPublic: boolean; // Whether coupon appears in public listings
  stackable: boolean; // Can be combined with other coupons
  firstTimeUserOnly: boolean;
  usageHistory: CouponUsage[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
  value: number;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  usageLimit?: number;
  usageLimitPerUser?: number;
  validFrom: Date;
  validUntil: Date;
  isActive?: boolean;
  isPublic?: boolean;
  stackable?: boolean;
  firstTimeUserOnly?: boolean;
}