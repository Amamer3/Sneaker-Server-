import { Order } from '../models/Order';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';

const ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);

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

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  const snapshot = await ordersCollection.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
}

export async function getAllOrders(): Promise<Order[]> {
  const snapshot = await ordersCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
}

export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  await ordersCollection.doc(id).update({ status, updatedAt: new Date() });
}
