import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { DocumentData, Query } from '@google-cloud/firestore';
import { admin } from '../config/firebase';
import { Order, OrderItem, OrderTracking, PaymentInfo, OrderDiscount } from '../models/Order';
import { Cart } from '../models/Cart';

import { NotificationService } from './notificationService';
import { CouponService } from './couponService';
import { updateProductSales } from './productService';

const ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);

interface GetOrdersResult {
  orders: Order[];
  total: number;
}

export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>, userId?: string): Promise<Order> {
  try {
    const tempOrderId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate and apply coupons if provided
    let finalTotal = order.subtotal;
    let discounts: OrderDiscount[] = [];
    
    if (order.couponCode && userId) {
      const couponService = new CouponService();
      
      // Create a temporary cart object for validation
       const tempCart: Cart = {
         id: tempOrderId,
         userId: userId,
         items: order.items.map(item => ({
           productId: item.productId,
           quantity: item.quantity,
           price: item.price,
           size: item.size,
           createdAt: new Date(),
           updatedAt: new Date()
         })),
         total: order.subtotal,
         createdAt: new Date(),
         updatedAt: new Date()
       };
      
      const validation = await couponService.validateCouponFull(
        order.couponCode, 
        userId, 
        tempCart, 
        order.subtotal
      );
      
      if (validation.isValid) {
        const discount = await couponService.applyCoupon(
          order.couponCode!,
          userId,
          tempOrderId,
          tempCart,
          order.subtotal
        );
        
        discounts.push({
          type: 'coupon',
          code: order.couponCode,
          amount: discount.discountAmount,
          description: `Coupon: ${order.couponCode}`
        });
        
        finalTotal = discount.finalAmount;
      }
    }

    // Calculate final total with shipping and tax
    const shippingCost = order.shippingCost || 0;
    const tax = order.tax || 0;
    const total = finalTotal + shippingCost + tax;

    // Create Firestore timestamp for dates
    const now = admin.firestore.Timestamp.now();
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 7); // Default 7 days

    const orderData: Omit<Order, 'id'> = {
      ...order,
      status: 'pending',
      total,
      subtotal: order.subtotal,
      shippingCost,
      tax,
      discounts,

      tracking: [{
        status: 'pending',
        message: 'Order placed successfully',
        location: 'System',
        timestamp: now.toDate(),
        updatedBy: 'System'
      }],
      paymentInfo: {
        method: order.paymentMethod || 'paystack',
        status: 'pending',
        transactionId: '',
        paidAt: undefined,
        amount: total,
        currency: order.currency || 'GHS'
      },
      createdAt: now.toDate(),
      updatedAt: now.toDate()
    };

    const docRef = await ordersCollection.add(orderData);
    if (!docRef.id) {
      throw new Error('No order ID received from database');
    }
    
    // Get the created order
    const orderDoc = await docRef.get();
    if (!orderDoc.exists) {
      throw new Error('Order was created but could not be retrieved');
    }
    
    const createdOrder = {
      id: orderDoc.id,
      ...orderDoc.data()
    } as Order;

    // Note: Order confirmation notification will be sent when payment is verified
    // and order status is updated to 'confirmed'
    
    return createdOrder;
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order in database');
  }
}

export async function getOrderById(id: string): Promise<Order | null> {
  const doc = await ordersCollection.doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    total: data?.total || data?.totalAmount || 0,
    totalAmount: data?.total || data?.totalAmount || 0, // Ensure both fields exist
    paymentMethod: data?.paymentMethod || 'paystack'
  } as Order;
}

export async function getAllOrders(
  page: number = 1,
  limit: number = 10,
  status?: string
): Promise<GetOrdersResult> {
  let query: Query<DocumentData> = ordersCollection.orderBy('createdAt', 'desc');

  if (status) {
    query = query.where('status', '==', status);
  }

  // Get total count
  const totalSnapshot = await query.count().get();
  const total = totalSnapshot.data().count;

  // Get paginated results
  const offset = (page - 1) * limit;
  const snapshot = await query
    .limit(limit)
    .offset(offset)
    .get();

  const orders = snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  }) as Order);

  return {
    orders,
    total
  };
}

export async function getOrdersByUser(
  userId: string,
  page: number = 1,
  limit: number = 10,
  status?: string
): Promise<GetOrdersResult> {
  let query: Query<DocumentData> = ordersCollection
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc');

  if (status) {
    query = query.where('status', '==', status);
  }

  // Get total count
  const totalSnapshot = await query.count().get();
  const total = totalSnapshot.data().count;

  // Get paginated results
  const offset = (page - 1) * limit;
  const snapshot = await query
    .limit(limit)
    .offset(offset)
    .get();

  const orders = snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  }) as Order);

  return {
    orders,
    total
  };
}

export async function updateOrderStatus(
  id: string, 
  status: Order['status'], 
  trackingInfo?: {
    description?: string;
    location?: string;
    trackingNumber?: string;
    carrier?: string;
  },
  updatedBy?: string
): Promise<void> {
  try {
    const doc = await ordersCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error('Order not found');
    }

    const order = { id: doc.id, ...doc.data() } as Order;
    const now = admin.firestore.Timestamp.now();

    // Create tracking event
    const trackingEvent = {
      status,
      timestamp: now,
      description: trackingInfo?.description || getStatusDescription(status),
      location: trackingInfo?.location || 'Warehouse',
      updatedBy: updatedBy || 'System'
    };

    // Update tracking events - tracking is an array of OrderTracking objects
    const updatedTracking = [...(order.tracking || []), trackingEvent];

    const updateData: any = {
      status,
      tracking: updatedTracking,
      updatedAt: now
    };

    // Update shipping info with tracking details if provided
    if (trackingInfo?.trackingNumber || trackingInfo?.carrier) {
      updateData.shipping = {
        ...order.shipping,
        ...(trackingInfo?.trackingNumber && { trackingNumber: trackingInfo.trackingNumber }),
        ...(trackingInfo?.carrier && { carrier: trackingInfo.carrier })
      };
    }

    // Handle status-specific logic
    if (status === 'confirmed') {
      // Update product sales count
      for (const item of order.items) {
        await updateProductSales(item.productId, item.quantity);
      }
    }

    if (status === 'cancelled') {
      console.log(`Order ${id} cancelled`);
    }

    if (status === 'delivered') {
      updateData.deliveredAt = now;
    }

    await ordersCollection.doc(id).update(updateData);

    // Send appropriate notification based on status
    try {
      const notificationService = new NotificationService();
      const updatedOrder = { ...order, ...updateData };
      
      if (status === 'confirmed') {
        // Send order confirmation notification for confirmed orders
        await notificationService.sendOrderConfirmation(updatedOrder);
      } else {
        // Send regular status update notification for other statuses
        await notificationService.sendOrderStatusUpdate(updatedOrder);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status');
  }
}

// Helper function to get status descriptions
function getStatusDescription(status: Order['status']): string {
  const descriptions = {
    pending: 'Order placed and awaiting confirmation',
    confirmed: 'Order confirmed and being prepared',
    processing: 'Order is being processed',
    shipped: 'Order has been shipped',
    delivered: 'Order has been delivered',
    cancelled: 'Order has been cancelled',
    refunded: 'Order has been refunded',
    failed: 'Order processing failed'
  };
  return descriptions[status] || 'Order status updated';
}

export async function getRecentOrders(limit: number = 10): Promise<Order[]> {
  const snapshot = await ordersCollection
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
}

// Update payment status
export async function updatePaymentStatus(
  orderId: string,
  paymentInfo: Partial<PaymentInfo>,
  updatedBy?: string
): Promise<void> {
  try {
    const doc = await ordersCollection.doc(orderId).get();
    if (!doc.exists) {
      throw new Error('Order not found');
    }

    const order = { id: doc.id, ...doc.data() } as Order;
    const now = admin.firestore.Timestamp.now();

    const updatedPaymentInfo = {
      ...order.paymentInfo,
      ...paymentInfo,
      ...(paymentInfo.status === 'completed' && { paidAt: now })
    };

    await ordersCollection.doc(orderId).update({
      paymentInfo: updatedPaymentInfo,
      updatedAt: now.toDate()
    });

    // If payment is completed, automatically confirm the order
    if (paymentInfo.status === 'completed' && order.status === 'pending') {
      await updateOrderStatus(orderId, 'confirmed', {
        description: 'Payment completed - Order confirmed'
      }, updatedBy);
    }

  } catch (error) {
    console.error('Error updating payment status:', error);
    throw new Error('Failed to update payment status');
  }
}

// Get order analytics
export async function getOrderAnalytics(startDate: Date, endDate: Date): Promise<{
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  topProducts: Array<{ productId: string; quantity: number; revenue: number }>;
}> {
  try {
    const snapshot = await ordersCollection
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const ordersByStatus: Record<string, number> = {};
    const productStats: Record<string, { quantity: number; revenue: number }> = {};
    
    orders.forEach(order => {
      // Count by status
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      
      // Aggregate product stats
      order.items.forEach(item => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = { quantity: 0, revenue: 0 };
        }
        productStats[item.productId].quantity += item.quantity;
        productStats[item.productId].revenue += item.price * item.quantity;
      });
    });
    
    const topProducts = Object.entries(productStats)
      .map(([productId, stats]) => ({ productId, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      ordersByStatus,
      topProducts
    };
  } catch (error) {
    console.error('Error getting order analytics:', error);
    throw new Error('Failed to get order analytics');
  }
}

// Search orders
export async function searchOrders(query: {
  searchTerm?: string;
  status?: Order['status'];
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}, page: number = 1, limit: number = 20): Promise<GetOrdersResult> {
  try {
    let firestoreQuery: Query<DocumentData> = ordersCollection;
    
    // Apply filters
    if (query.status) {
      firestoreQuery = firestoreQuery.where('status', '==', query.status);
    }
    
    if (query.userId) {
      firestoreQuery = firestoreQuery.where('userId', '==', query.userId);
    }
    
    if (query.startDate) {
      firestoreQuery = firestoreQuery.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(query.startDate));
    }
    
    if (query.endDate) {
      firestoreQuery = firestoreQuery.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(query.endDate));
    }
    
    if (query.minAmount) {
      firestoreQuery = firestoreQuery.where('total', '>=', query.minAmount);
    }
    
    if (query.maxAmount) {
      firestoreQuery = firestoreQuery.where('total', '<=', query.maxAmount);
    }
    
    // Order by creation date
    firestoreQuery = firestoreQuery.orderBy('createdAt', 'desc');
    
    // Get total count
    const totalSnapshot = await firestoreQuery.count().get();
    const total = totalSnapshot.data().count;
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const snapshot = await firestoreQuery
      .limit(limit)
      .offset(offset)
      .get();
    
    let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    // Apply text search if provided
    if (query.searchTerm) {
      const searchLower = query.searchTerm.toLowerCase();
      orders = orders.filter(order => 
        order.id.toLowerCase().includes(searchLower) ||
        order.user?.email?.toLowerCase().includes(searchLower) ||
        order.user?.name?.toLowerCase().includes(searchLower) ||
        order.shippingAddress?.city?.toLowerCase().includes(searchLower)
      );
    }
    
    return { orders, total };
  } catch (error) {
    console.error('Error searching orders:', error);
    throw new Error('Failed to search orders');
  }
}

// Cancel order
export async function cancelOrder(orderId: string, reason: string, cancelledBy?: string): Promise<void> {
  try {
    const doc = await ordersCollection.doc(orderId).get();
    if (!doc.exists) {
      throw new Error('Order not found');
    }

    const order = { id: doc.id, ...doc.data() } as Order;
    
    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new Error('Order cannot be cancelled');
    }

    await updateOrderStatus(orderId, 'cancelled', {
      description: `Order cancelled: ${reason}`,
      location: 'System'
    }, cancelledBy);

    // Send cancellation notification
    try {
      const notificationService = new NotificationService();
      await notificationService.sendOrderCancellation(order, reason);
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
    }

  } catch (error) {
    console.error('Error cancelling order:', error);
    throw new Error('Failed to cancel order');
  }
}

// Get order tracking
export async function getOrderTracking(orderId: string): Promise<OrderTracking[] | null> {
  try {
    const order = await getOrderById(orderId);
    return order?.tracking || null;
  } catch (error) {
    console.error('Error getting order tracking:', error);
    return null;
  }
}

// Process refund
export async function processRefund(
  orderId: string,
  amount: number,
  reason: string,
  processedBy?: string
): Promise<void> {
  try {
    const doc = await ordersCollection.doc(orderId).get();
    if (!doc.exists) {
      throw new Error('Order not found');
    }

    const order = { id: doc.id, ...doc.data() } as Order;
    const now = admin.firestore.Timestamp.now();

    // Update payment info with refund details
    const updatedPaymentInfo = {
      ...order.paymentInfo,
      refundAmount: (order.paymentInfo?.refundAmount || 0) + amount,
      refundStatus: amount >= order.total ? 'full_refund' : 'partial_refund',
      refundedAt: now,
      refundReason: reason
    };

    await ordersCollection.doc(orderId).update({
      paymentInfo: updatedPaymentInfo,
      updatedAt: now.toDate()
    });

    // Add tracking event
    await updateOrderStatus(orderId, order.status, {
      description: `Refund processed: $${amount.toFixed(2)} - ${reason}`
    }, processedBy);

  } catch (error) {
    console.error('Error processing refund:', error);
    throw new Error('Failed to process refund');
  }
}

// Export orders for a date range
export async function getOrdersForExport(startDate: Date, endDate: Date): Promise<Order[]> {
  try {
    const snapshot = await ordersCollection
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  } catch (error) {
    console.error('Error getting orders for export:', error);
    throw new Error('Failed to get orders for export');
  }
}
