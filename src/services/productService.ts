import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { Product, ProductImage } from '../models/Product';
import { cacheKey, getCache, setCache, clearCache } from '../utils/cache';
import { CollectionReference, Query, DocumentData } from '@google-cloud/firestore';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;
const productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);

interface ProductQuery {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  featured?: boolean;
  inStock?: boolean;
  status?: string;
  sort?: string;
  search?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

interface ProductFilters {
  categories: string[];
  brands: string[];
  priceRange: {
    min: number;
    max: number;
  };
  sizes: string[];
}

interface ProductReview {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
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
  const {
    page = 1,
    limit = DEFAULT_LIMIT,
    category,
    brand,
    featured,
    inStock,
    status = 'published',
    sortField = 'createdAt',
    sortDirection = 'desc'
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
    sortField, 
    sortDirection 
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
    switch (sortField) {
      case 'price':
        finalQuery = baseQuery.orderBy('price', sortDirection);
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
  
  const products = snapshot.docs.map(doc => transformProductData(doc));

  const response: PaginatedResponse<Product> = {
    items: products,
    total,
    page: sanitizedPage,
    limit: sanitizedLimit,
    totalPages: Math.ceil(total / sanitizedLimit),
    hasMore: offset + products.length < total
  };

  // Cache the results
  await setCache(cacheKeyString, response);
  
  return response;
}

// For empty results
const emptyResponse: PaginatedResponse<Product> = {
  items: [],
  total: 0,
  page: 1,
  limit: DEFAULT_LIMIT,
  totalPages: 0,
  hasMore: false
};

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

export async function getProductFilters(): Promise<ProductFilters> {
  const cacheKeyString = cacheKey('product-filters', {});
  const cached = await getCache<ProductFilters>(cacheKeyString);
  
  if (cached) {
    return cached;
  }

  const productsSnap = await productsCollection
    .where('status', '==', 'published')
    .get();

  const products = productsSnap.docs.map(doc => doc.data() as Product);
  
  const filters: ProductFilters = {
    categories: Array.from(new Set(products.map((p: Product) => p.category))).filter(Boolean),
    brands: Array.from(new Set(products.map((p: Product) => p.brand))).filter(Boolean),
    priceRange: {
      min: Math.min(...products.map(p => p.price)),
      max: Math.max(...products.map(p => p.price))
    },
    sizes: Array.from(new Set(products.flatMap((p: Product) => p.sizes || []))).filter(Boolean)
  };

  await setCache(cacheKeyString, filters);  // Using default TTL from cache utility

  return filters;
}

export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  try {
    const reviewsCollection = FirestoreService.collection(COLLECTIONS.REVIEWS);
    const snapshot = await reviewsCollection
      .where('productId', '==', productId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate()
    })) as ProductReview[];
  } catch (error) {
    console.error('Error getting product reviews:', error);
    return [];
  }
}

export async function addProductReview(
  productId: string,
  userId: string,
  data: { rating: number; comment: string }
): Promise<ProductReview> {
  const reviewsCollection = FirestoreService.collection(COLLECTIONS.REVIEWS);
  const now = new Date();

  const review: Omit<ProductReview, 'id'> = {
    productId,
    userId,
    rating: data.rating,
    comment: data.comment,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await reviewsCollection.add(review);
  return { ...review, id: docRef.id };
}
