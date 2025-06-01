import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Product } from '../models/Product';

const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);

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

export async function deleteImage(productId: string, imageId: string): Promise<Product | null> {
  const docRef = productsCollection.doc(productId);
  const doc = await docRef.get();
  if (!doc.exists) return null;

  const product = doc.data() as Product;
  const updatedImages = product.images.filter(image => image.id !== imageId);

  await docRef.update({ images: updatedImages, updatedAt: new Date() });
  const updated = await docRef.get();
  return updated.data() as Product;
}

export async function reorderImages(productId: string, imageOrder: { id: string; order: number }[]): Promise<Product | null> {
  const docRef = productsCollection.doc(productId);
  const doc = await docRef.get();
  if (!doc.exists) return null;

  const product = doc.data() as Product;
  const updatedImages = product.images.map(image => {
    const newOrder = imageOrder.find(order => order.id === image.id)?.order;
    return newOrder ? { ...image, order: newOrder } : image;
  });

  await docRef.update({ images: updatedImages, updatedAt: new Date() });
  const updated = await docRef.get();
  return updated.data() as Product;
}

export async function getProduct(id: string): Promise<Product | null> {
  const doc = await productsCollection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Product;
}
