import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Product, ProductImage } from '../models/Product';
import { cacheKey, getCache, setCache, clearCache } from '../utils/cache';
import { CollectionReference, Query, DocumentData } from '@google-cloud/firestore';

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

const transformProductData = (doc: FirebaseFirestore.DocumentData): Product => {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    images: Array.isArray(data.images) ? data.images.map((img: any, index: number) => ({
      id: img.id || `img-${index}`,
      url: img.url || img, // Handle both new and old image format
      order: img.order || index,
      publicId: img.publicId
    })) : [],
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date()
  };
};

const baseProductData: Omit<Product, 'id'> = {
  name: '',
  brand: '',
  description: '',
  price: 0,
  category: '',
  sizes: [],
  images: [],
  inStock: true,
  stock: 0,
  featured: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

export async function invalidateCache(): Promise<void> {
  await clearCache('products:*');
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const now = new Date();
  
  // Ensure images array is properly structured
  const images = (data.images || []).map((image: ProductImage, index: number) => ({
    id: image.id || `img-${index}`,
    url: image.url,
    order: image.order || index,
    publicId: image.publicId
  }));

  const product: Omit<Product, 'id'> = {
    ...baseProductData,
    ...data,
    images,
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

export async function getAllProducts(params: ProductQuery = {}): Promise<PaginatedResponse<Product>> {
  try {
    const {
      page = 1,
      limit = DEFAULT_LIMIT,
      category,
      brand,
      featured,
      sort = 'createdAt',
      search = ''
    } = params;

    // Validate and sanitize limit
    const sanitizedLimit = Math.min(Math.max(1, Number(limit)), MAX_LIMIT);
    const sanitizedPage = Math.max(1, Number(page));
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    // Try to get from cache first
    const cacheKeyString = cacheKey('products', { 
      page: sanitizedPage, 
      limit: sanitizedLimit, 
      category, 
      brand, 
      featured, 
      sort, 
      search 
    });
    
    const cached = await getCache<PaginatedResponse<Product>>(cacheKeyString);
    if (cached) return cached;

    // Build base query
    let baseQuery: Query<DocumentData> = productsCollection;

    // Handle featured products separately to avoid index issues
    if (featured) {
      // For featured products, use a simpler query
      baseQuery = baseQuery.where('featured', '==', true);
    } else {
      // Apply filters for non-featured queries
      if (category) {
        baseQuery = baseQuery.where('category', '==', category);
      }
      if (brand) {
        baseQuery = baseQuery.where('brand', '==', brand);
      }
    }

    // Get total count first
    let total: number;
    try {
      const totalSnap = await baseQuery.count().get();
      total = totalSnap.data().count;
    } catch (error) {
      console.warn('Count failed, estimating total:', error);
      const allDocs = await baseQuery.get();
      total = allDocs.size;
    }

    // Build the final query with sorting
    let finalQuery: Query<DocumentData>;
    try {
      switch (sort) {
        case 'price_asc':
          finalQuery = baseQuery.orderBy('price', 'asc');
          break;
        case 'price_desc':
          finalQuery = baseQuery.orderBy('price', 'desc');
          break;
        case 'newest':
          finalQuery = baseQuery.orderBy('createdAt', 'desc');
          break;
        default:
          finalQuery = baseQuery.orderBy('createdAt', 'desc');
      }
    } catch (error) {
      console.warn('Sort failed, falling back to default sort:', error);
      finalQuery = baseQuery.orderBy('createdAt', 'desc');
    }

    // Apply pagination
    try {
      finalQuery = finalQuery.limit(sanitizedLimit).offset(offset);
    } catch (error) {
      console.warn('Pagination failed, using simple limit:', error);
      finalQuery = finalQuery.limit(sanitizedLimit);
    }

    // Execute query
    const snapshot = await finalQuery.get();
    
    const items = snapshot.docs.map(doc => transformProductData(doc));

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
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    return {
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
      hasMore: false
    };
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const doc = await productsCollection.doc(id).get();
    if (!doc.exists) return null;
    
    return transformProductData(doc);
  } catch (error) {
    console.error('Error in getProductById:', error);
    return null;
  }
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
