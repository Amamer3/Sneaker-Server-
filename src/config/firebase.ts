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

export { admin, firestore };

