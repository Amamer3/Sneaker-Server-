import { Address } from '../models/Order';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';

import { DocumentData, Query, CollectionReference } from '@google-cloud/firestore';

const usersCollection = FirestoreService.collection(COLLECTIONS.USERS) as CollectionReference<DocumentData>;

export async function updateProfile(userId: string, data: any): Promise<void> {
  await usersCollection.doc(userId).update(data);
}

export async function getUserById(userId: string): Promise<any> {
  const doc = await usersCollection.doc(userId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function addAddress(userId: string, address: Address): Promise<string> {
  const addressRef = usersCollection.doc(userId).collection('addresses').doc();
  await addressRef.set(address);
  return addressRef.id;
}

export async function updateAddress(userId: string, addressId: string, address: Address): Promise<void> {
  await usersCollection.doc(userId).collection('addresses').doc(addressId).update({ ...address });
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await usersCollection.doc(userId).collection('addresses').doc(addressId).delete();
}

export async function getAddresses(userId: string): Promise<Address[]> {
  const snapshot = await usersCollection.doc(userId).collection('addresses').get();
  return snapshot.docs.map(doc => ({ ...doc.data() } as Address));
}

interface GetAllUsersResult {
  users: any[];
  total: number;
}

export async function getAllUsers(page: number = 1, limit: number = 10, search: string = ''): Promise<GetAllUsersResult> {
  let query: Query<DocumentData> = usersCollection;

  // Add search if provided
  if (search) {
    query = query.where('name', '>=', search)
                 .where('name', '<=', search + '\uf8ff');
  }

  // Get total count
  const totalSnapshot = await query.count().get();
  const total = totalSnapshot.data().count;

  // Get paginated results
  const offset = (page - 1) * limit;
  const snapshot = await query
    .orderBy('name')
    .limit(limit)
    .offset(offset)
    .get();

  const users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    password: undefined // Remove password from response
  }));

  return {
    users,
    total
  };
}

export async function deleteUser(userId: string): Promise<void> {
  await usersCollection.doc(userId).delete();
}

export async function getAdminActivity(userId: string, options: {
  page?: number;
  limit?: number;
} = {}): Promise<{
  activities: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  try {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    // Query login_logs collection for this admin user
    const loginLogsCollection = FirestoreService.collection(COLLECTIONS.LOGIN_LOGS);
    
    // Get total count with error handling
    let total = 0;
    try {
      const totalQuery = loginLogsCollection.where('userId', '==', userId);
      const totalSnapshot = await totalQuery.count().get();
      total = totalSnapshot.data().count;
    } catch (countError) {
      console.warn('Could not get count for login logs, using fallback:', countError);
      // Fallback: get all docs and count them
      const fallbackSnapshot = await loginLogsCollection.where('userId', '==', userId).get();
      total = fallbackSnapshot.size;
    }

    // Get paginated activities with error handling
    let activities: any[] = [];
    try {
      const activitiesSnapshot = await loginLogsCollection
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
    } catch (queryError) {
      console.warn('Could not query login logs with orderBy, trying simple query:', queryError);
      // Fallback: simple query without orderBy
      const fallbackSnapshot = await loginLogsCollection
        .where('userId', '==', userId)
        .limit(limit)
        .get();

      activities = fallbackSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
    }

    const totalPages = Math.ceil(total / limit);

    return {
      activities,
      total,
      page,
      totalPages
    };
  } catch (error) {
    console.error('Get admin activity error:', error);
    // Return empty result instead of throwing
    return {
      activities: [],
      total: 0,
      page: Number(options.page) || 1,
      totalPages: 0
    };
  }
}
