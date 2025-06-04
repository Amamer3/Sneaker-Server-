import { Order } from '../models/Order';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { DocumentData, Query } from '@google-cloud/firestore';

const ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);

interface GetOrdersResult {
  orders: Order[];
  total: number;
}

export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date();
  const docRef = await ordersCollection.add({
    ...order,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const doc = await ordersCollection.doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Order;
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
  await ordersCollection.doc(id).update({ status, updatedAt: new Date() });
}
