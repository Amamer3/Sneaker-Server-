import { firestore } from '../config/firebase';
import { COLLECTIONS, CollectionName, SUB_COLLECTIONS, SubCollectionName } from '../constants/collections';

/**
 * Utility class to handle Firestore operations with type safety and consistent collection access
 */
export class FirestoreService {
  /**
   * Get a typed reference to a Firestore collection
   * @param collection The collection name from COLLECTIONS constant
   * @returns A typed Firestore collection reference
   */
  static collection(collection: CollectionName) {
    return firestore.collection(collection);
  }

  /**
   * Get a document reference from a collection
   * @param collection The collection name
   * @param docId The document ID
   * @returns A document reference
   */
  static doc(collection: CollectionName, docId: string) {
    return this.collection(collection).doc(docId);
  }

  /**
   * Create a new document with auto-generated ID
   * @param collection The collection name
   * @param data The document data
   * @returns The created document reference and data with ID
   */  static async create<T extends { id: string; createdAt: Date; updatedAt: Date }>(
    collection: CollectionName,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const now = new Date();
    const docRef = this.collection(collection).doc();
    
    const documentData = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;

    await docRef.set(documentData);
    return documentData;
  }

  /**
   * Update a document
   * @param collection The collection name
   * @param docId The document ID
   * @param data The update data
   */
  static async update<T>(
    collection: CollectionName,
    docId: string,
    data: Partial<T>
  ): Promise<void> {
    await this.doc(collection, docId).update({
      ...data,
      updatedAt: new Date()
    });
  }

  /**
   * Delete a document
   * @param collection The collection name
   * @param docId The document ID
   */
  static async delete(collection: CollectionName, docId: string): Promise<void> {
    await this.doc(collection, docId).delete();
  }

  /**
   * Get a sub-collection reference
   * @param collection The main collection name
   * @param docId The document ID
   * @param subCollection The sub-collection name
   * @returns A collection reference to the sub-collection
   */
  static subCollection(
    collection: CollectionName,
    docId: string,
    subCollection: SubCollectionName
  ) {
    return this.doc(collection, docId).collection(subCollection);
  }

  /**
   * Create a document in a sub-collection
   * @param collection The main collection name
   * @param docId The main document ID
   * @param subCollection The sub-collection name
   * @param data The document data
   * @returns The created document data with ID
   */
  static async createInSubCollection<T extends { id: string; createdAt: Date; updatedAt: Date }>(
    collection: CollectionName,
    docId: string,
    subCollection: SubCollectionName,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const now = new Date();
    const docRef = this.subCollection(collection, docId, subCollection).doc();
    
    const documentData = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;

    await docRef.set(documentData);
    return documentData;
  }
}
