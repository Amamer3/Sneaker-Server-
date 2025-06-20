export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  zipCode?: string;
  phone: string;  // Add phone to address interface
}

export interface OrderItem {
  productId: string;
  name: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  size?: string;
  color?: string;
  image: string;
  sku?: string;
  weight?: number;
}

export interface ShippingInfo {
  name: string;
  email: string;
  phone: string;
  address: Address;
  city?: string;
  state?: string;
  country?: string;
  method: 'standard' | 'express' | 'overnight' | 'pickup';
  cost: number;
  estimatedDelivery?: Date;
  trackingNumber?: string;
  carrier?: string;
}

export interface PaymentInfo {
  method: 'paystack' | 'stripe' | 'paypal' | 'bank_transfer' | 'cash_on_delivery';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  transactionId?: string;
  reference?: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
  fees?: number;
}

export interface OrderTracking {
  status: string;
  message: string;
  location?: string;
  timestamp: Date;
  updatedBy?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export interface OrderDiscount {
  type: 'percentage' | 'fixed' | 'shipping' | 'coupon';
  code?: string;
  amount: number;
  description: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  shippingCost: number;
  discounts?: OrderDiscount[];
  totalDiscount: number;
  total: number;
  couponCode?: string;
  totalAmount: number;  // For backward compatibility
  currency: string;
  paymentMethod?: 'paystack' | 'stripe' | 'paypal' | 'bank_transfer' | 'cash_on_delivery';
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'failed';
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  shippingAddress: Address;
  billingAddress?: Address;
  shipping: ShippingInfo;
  payment: PaymentInfo;
  paymentInfo?: PaymentInfo;
  user: UserInfo;
  tracking?: OrderTracking[];
  reservationIds?: string[];
  notes?: string;
  internalNotes?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  refundReason?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: 'web' | 'mobile' | 'admin' | 'api';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  name?: string;
  price: number;
  image?: string;
}

export interface CreateOrderInput {
  items: CreateOrderItemInput[];
  shippingAddress: Address & { phone: string };  // Ensure phone is required
  total?: number;
}

export interface UpdateOrderStatusInput {
  status: Order['status'];
}

export interface OrderQueryOptions {
  page?: number;
  limit?: number;
  status?: Order['status'];
  sortBy?: 'createdAt' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}
