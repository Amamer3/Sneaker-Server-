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
  sortBy?: string;        // Add support for frontend's sortBy parameter
  order?: 'asc' | 'desc'; // Add support for frontend's order parameter
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
    sort,        // Handle sort parameter in format "field:direction"
    sortBy,      // Handle sortBy from frontend
    order,       // Handle order from frontend
  } = params;

  // Parse sort parameter if provided (format: "field:direction")
  let sortField = 'createdAt';
  let sortDirection: 'asc' | 'desc' = 'desc';
  
  if (sort) {
    const [field, direction] = sort.split(':');
    if (field) sortField = field;
    if (direction && ['asc', 'desc'].includes(direction.toLowerCase())) {
      sortDirection = direction.toLowerCase() as 'asc' | 'desc';
    }
  } else if (sortBy) {
    sortField = sortBy;
    if (order && ['asc', 'desc'].includes(order.toLowerCase())) {
      sortDirection = order.toLowerCase() as 'asc' | 'desc';
    }
  }

  // Validate and sanitize limit
  const sanitizedLimit = Math.min(Math.max(1, Number(limit)), MAX_LIMIT);
  const sanitizedPage = Math.max(1, Number(page));
  const offset = (sanitizedPage - 1) * sanitizedLimit;

  // Generate cache key
  const cacheKeyString = cacheKey('products', { 
    page: sanitizedPage, 
    limit: sanitizedLimit, 
    category, 
    brand, 
    featured, 
    sortField, 
    sortDirection 
  });

  // Try to get from cache first
  const cached = await getCache<PaginatedResponse<Product>>(cacheKeyString);
  if (cached) return cached;

  try {
    // Build base query
    let query: FirebaseFirestore.Query = productsCollection;

    // Add filters one by one
    if (featured !== undefined) {
      // Convert string 'true'/'false' to boolean if needed
      const featuredBool = typeof featured === 'string' ? featured === 'true' : featured;
      query = query.where('featured', '==', featuredBool);
      console.log('Filtering by featured:', featuredBool);
    }

    // Add sorting
    query = query.orderBy('createdAt', 'desc');

    // Get total count before applying pagination
    const countSnapshot = await query.get();
    const total = countSnapshot.size;

    // Add pagination
    query = query
      .offset(offset)
      .limit(sanitizedLimit);

    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => transformProductData(doc));

    const response: PaginatedResponse<Product> = {
      items: products,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages: Math.ceil(total / sanitizedLimit),
      hasMore: offset + products.length < total
    };

    // Cache the response
    await setCache(cacheKeyString, response);
    
    return response;
  } catch (error: any) {
    // Check if the error is due to missing index
    if (error.code === 9 && error.message.includes('requires an index')) {
      const indexUrl = error.message.split('create it here: ')[1];
      throw new Error(`This query requires a composite index. Please create it at: ${indexUrl}`);
    }
    throw error;
  }
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
  
  // Create update data object without undefined values
  const baseData = {
    ...data,
    updatedAt: new Date()
  };

  // Only add searchTokens if name is being updated
  if (data.name) {
    const nameTokens = data.name.toLowerCase().split(' ');
    const brandTokens = data.brand ? [data.brand.toLowerCase()] : [];
    const categoryTokens = data.category ? [data.category.toLowerCase()] : [];
    
    const tokens = new Set([
      ...nameTokens,
      ...brandTokens,
      ...categoryTokens,
      // Add word combinations
      data.name.toLowerCase(),
      // Add partial matches
      ...nameTokens.flatMap(word => {
        const partials = [];
        for (let i = 1; i <= word.length; i++) {
          partials.push(word.substring(0, i));
        }
        return partials;
      })
    ]);

    baseData.searchTokens = Array.from(tokens);
  }

  // Filter out any undefined values to prevent Firestore errors
  const updateData = Object.entries(baseData).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
  
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
