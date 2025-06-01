import { firestore } from '../config/firebase';
import { Product } from '../models/Product';

const productsCollection = firestore.collection('products');

export async function createProduct(data: any): Promise<Product> {
  const now = new Date();
  const product: Product = {
    ...data,
    id: '',
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await productsCollection.add(product);
  await docRef.update({ id: docRef.id });
  return { ...product, id: docRef.id };
}

export async function getAllProducts(query: any = {}): Promise<Product[]> {
  let ref = productsCollection as FirebaseFirestore.Query;
  if (query.category) ref = ref.where('category', '==', query.category);
  if (query.brand) ref = ref.where('brand', '==', query.brand);
  if (query.featured) ref = ref.where('featured', '==', query.featured === 'true');
  const snap = await ref.get();
  return snap.docs.map(doc => doc.data() as Product);
}

export async function getProductById(id: string): Promise<Product | null> {
  const doc = await productsCollection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Product;
}

export async function updateProduct(id: string, data: any): Promise<Product | null> {
  const docRef = productsCollection.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  await docRef.update({ ...data, updatedAt: new Date() });
  const updated = await docRef.get();
  return updated.data() as Product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  await productsCollection.doc(id).delete();
  return true;
}
