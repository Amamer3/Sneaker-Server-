import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID!,
  });
}

const firestore = admin.firestore();
// Configure Firestore to ignore undefined values
firestore.settings({
  ignoreUndefinedProperties: true
});

// FirestoreService class for database operations
export class FirestoreService {
  static collection(name: string) {
    return firestore.collection(name);
  }

  static doc(path: string) {
    return firestore.doc(path);
  }

  static batch() {
    return firestore.batch();
  }

  static runTransaction(updateFunction: any) {
    return firestore.runTransaction(updateFunction);
  }
}

export { admin, firestore };

