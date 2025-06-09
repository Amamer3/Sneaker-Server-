import { Order } from '../models/Order';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { DocumentData, Query } from '@google-cloud/firestore';
import { admin } from '../config/firebase';

const ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);

interface GetOrdersResult {
  orders: Order[];
  total: number;
}

export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
  try {
    // Create Firestore timestamp for dates
    const now = admin.firestore.Timestamp.now();
    const shippingAddress = {
      street: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      country: order.shippingAddress.country,
      postalCode: order.shippingAddress.postalCode,
      phone: order.shippingAddress.phone,
      // Only include zipCode if it's provided
      ...(order.shippingAddress.zipCode && { zipCode: order.shippingAddress.zipCode })
    };

    const orderData = {
      ...order,
      status: order.status || 'pending',
      total: order.total || 0,
      totalAmount: order.total || 0, // Set totalAmount same as total for compatibility
      paymentMethod: order.paymentMethod || 'paystack', // Default payment method
      shippingAddress,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await ordersCollection.add(orderData);
    if (!docRef.id) {
      throw new Error('No order ID received from database');
    }
    
    // Return the complete order object
    const orderDoc = await docRef.get();
    if (!orderDoc.exists) {
      throw new Error('Order was created but could not be retrieved');
    }
    
    return {
      id: orderDoc.id,
      ...orderDoc.data()
    } as Order;
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

export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  const doc = await ordersCollection.doc(id).get();
  if (!doc.exists) {
    throw new Error('Order not found');
  }
  await ordersCollection.doc(id).update({ 
    status, 
    updatedAt: new Date() 
  });
}

export async function getRecentOrders(limit: number = 10): Promise<Order[]> {
  const snapshot = await ordersCollection
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
}
