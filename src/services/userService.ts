import { firestore } from '../config/firebase';
import { Address } from '../models/Order';

const usersCollection = firestore.collection('users');

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

export async function getAllUsers(): Promise<any[]> {
  const snapshot = await usersCollection.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteUser(userId: string): Promise<void> {
  await usersCollection.doc(userId).delete();
}
