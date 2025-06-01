import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { firestore } from '../config/firebase';
import { User } from '../models/User';
import admin from 'firebase-admin';

const usersCollection = firestore.collection('users');

export async function register(data: any): Promise<any> {
  const { email, password, name, role = 'customer' } = data;
  // Check if user already exists
  const userSnap = await usersCollection.where('email', '==', email).get();
  if (!email || !password || !name) throw new Error('All fields required');
  if (!userSnap.empty) throw new Error('Email already registered');

  // Create user in Firebase Authentication
  const firebaseUser = await admin.auth().createUser({
    email,
    password,
    displayName: name,
  });

  const now = new Date();
  const user: User = {
    id: firebaseUser.uid,
    email,
    name,
    role,
    createdAt: now,
    updatedAt: now,
  };

  // Store user in Firestore
  await usersCollection.doc(firebaseUser.uid).set(user);

  const token = jwt.sign({ id: firebaseUser.uid, role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return { token, user };
}

export async function login(data: any): Promise<any> {
  const { email, password } = data;
  if (!email || !password) throw new Error('All fields required');
  const userSnap = await usersCollection.where('email', '==', email).get();
  if (userSnap.empty) throw new Error('Invalid credentials');
  const userDoc = userSnap.docs[0];
  const userData = userDoc.data();
  const match = await bcrypt.compare(password, userData.password);
  if (!match) throw new Error('Invalid credentials');
  const token = jwt.sign({ id: userDoc.id, role: userData.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const { password: _, ...user } = userData;
  return { token, user: { ...user, id: userDoc.id } };
}

export async function getProfile(userId: string): Promise<User> {
  const userDoc = await usersCollection.doc(userId).get();
  if (!userDoc.exists) throw new Error('User not found');
  const { password, ...user } = userDoc.data() as User & { password?: string };
  return { ...user, id: userDoc.id };
}
