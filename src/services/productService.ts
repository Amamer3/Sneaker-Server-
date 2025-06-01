import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Product, ProductImage } from '../models/Product';
import { cacheKey, getCache, setCache, clearCache } from '../utils/cache';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;
const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);

interface ProductQuery {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  featured?: boolean;
  sort?: string;
  search?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export async function invalidateCache(): Promise<void> {
  await clearCache('products:*');
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const now = new Date();
  
  // Ensure images array is properly structured
  const images = (data.images || []).map((image: ProductImage, index: number) => ({
    ...image,
    order: index
  }));

  const product: Omit<Product, 'id'> = {
    name: data.name || '',
    brand: data.brand || '',
    description: data.description || '',
    price: data.price || 0,
    category: data.category || '',
    sizes: data.sizes || [],
    images,
    inStock: data.inStock ?? true,
    stock: data.stock || 0,
    featured: data.featured || false,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await productsCollection.add(product);
  const productWithId = { ...product, id: docRef.id };
  await docRef.update({ id: docRef.id });

  // Clear cache after creating new product
  await clearCache('products:*');

  return productWithId;
}

export async function getAllProducts(query: ProductQuery = {}): Promise<PaginatedResponse<Product>> {
  const {
    page = 1,
    limit = DEFAULT_LIMIT,
    category,
    brand,
    featured,
    sort = 'createdAt',
    search = ''
  } = query;

  // Validate and sanitize limit
  const sanitizedLimit = Math.min(Math.max(1, Number(limit)), MAX_LIMIT);
  const sanitizedPage = Math.max(1, Number(page));
  const offset = (sanitizedPage - 1) * sanitizedLimit;

  // Try to get from cache
  const cacheKeyString = cacheKey('products', { page: sanitizedPage, limit: sanitizedLimit, category, brand, featured, sort, search });
  const cached = await getCache<PaginatedResponse<Product>>(cacheKeyString);
  if (cached) return cached;

  // Build query
  let ref = productsCollection as FirebaseFirestore.Query;
  
  if (category) ref = ref.where('category', '==', category);
  if (brand) ref = ref.where('brand', '==', brand);
  if (featured) ref = ref.where('featured', '==', true);
  
  // Add search condition if provided
  if (search) {
    ref = ref.where('searchTokens', 'array-contains', search.toLowerCase());
  }

  // Get total count for pagination
  const totalSnapshot = await ref.count().get();
  const total = totalSnapshot.data().count;

  // Apply sorting
  switch (sort) {
    case 'price_asc':
      ref = ref.orderBy('price', 'asc');
      break;
    case 'price_desc':
      ref = ref.orderBy('price', 'desc');
      break;
    case 'newest':
      ref = ref.orderBy('createdAt', 'desc');
      break;
    default:
      ref = ref.orderBy('createdAt', 'desc');
  }

  // Apply pagination
  ref = ref.limit(sanitizedLimit).offset(offset);

  // Get paginated results
  const snap = await ref.get();
  const items = snap.docs.map(doc => doc.data() as Product);

  const response: PaginatedResponse<Product> = {
    items,
    total,
    page: sanitizedPage,
    totalPages: Math.ceil(total / sanitizedLimit),
    hasMore: offset + items.length < total
  };

  // Cache the results
  await setCache(cacheKeyString, response);

  return response;
}

export async function getProductById(id: string): Promise<Product | null> {
  const doc = await productsCollection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Product;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product | null> {
  const docRef = productsCollection.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  
  const updateData = {
    ...data,
    updatedAt: new Date(),
    // Generate search tokens for text search
    searchTokens: data.name ? 
      data.name.toLowerCase().split(' ').filter(token => token.length > 2) : 
      undefined
  };
  
  await docRef.update(updateData);
  
  // Clear cache when product is updated
  await clearCache('products:*');
  
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
