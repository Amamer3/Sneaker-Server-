import { COLLECTIONS } from '../constants/collections';
import { Product, ProductImage, ProductVariant, ProductSEO } from '../models/Product';
import { cacheKey, getCache, setCache, clearCache } from '../utils/cache';
import { admin, FirestoreService } from '../config/firebase';

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
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
};

export async function invalidateCache(): Promise<void> {
  await clearCache('products:*');
}

export async function createProduct(data: Partial<Product>, createdBy?: string): Promise<Product> {
  const now = new Date();
  
  // Ensure images array is properly structured
  const images = (data.images || []).map((image: ProductImage, index: number) => ({
    id: image.id || `img-${index}`,
    url: image.url,
    order: image.order || index,
    publicId: image.publicId,
    alt: image.alt || data.name || 'Product image'
  }));

  // Generate SEO slug if not provided
  const seo: ProductSEO = {
    slug: data.seo?.slug || generateSlug(data.name || ''),
    metaTitle: data.seo?.metaTitle || data.name,
    metaDescription: data.seo?.metaDescription || data.description?.substring(0, 160),
    keywords: data.seo?.keywords || generateKeywords(data)
  };

  // Process variants if provided
  const variants: ProductVariant[] = data.variants || data.sizes?.map(size => ({
    size,
    stock: data.stock || 0,
    sku: `${data.name?.replace(/\s+/g, '-').toLowerCase()}-${size}`.substring(0, 50)
  })) || [];

  const product: Omit<Product, 'id'> = {
    ...baseProductData,
    ...data,
    images,
    variants,
    seo,
    status: data.status || 'active',
    lowStockThreshold: data.lowStockThreshold || 10,
    rating: 0,
    reviewCount: 0,
    totalSold: 0,
    views: 0,
    wishlistCount: 0,
    searchTokens: generateSearchTokens(data.name || '', data.brand || '', data.category || '', data.tags),
    createdAt: now,
    updatedAt: now
  };

  const docRef = await productsCollection.add(product);
  const productWithId = { ...product, id: docRef.id };
  await docRef.update({ id: docRef.id });

  // Initialize inventory for the product
  // Stock management removed - inventory system no longer available

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

// Alias for backward compatibility
// This comment has been removed since getProduct is defined below

export async function updateProduct(id: string, data: Partial<Product>, updatedBy?: string): Promise<Product | null> {
  const docRef = productsCollection.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  
  const currentProduct = doc.data() as Product;
  
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

  // Inventory management removed - stock updates no longer synced to inventory system

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

export async function getProduct(id: string, includeInventory: boolean = true): Promise<Product | null> {
  const doc = await productsCollection.doc(id).get();
  if (!doc.exists) return null;
  
  const product = doc.data() as Product;
  
  // Inventory system removed - using product stock data directly
  if (includeInventory) {
    // Stock information is now managed directly in product data
    product.inStock = (product.stock || 0) > 0;
  }
  
  return product;
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

  let products = productsSnap.docs.map(doc => ({
    ...doc.data(),
    id: doc.id
  })) as Product[];

  // Inventory system removed - using product stock data directly
  
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

// Helper function to generate search tokens
function generateSearchTokens(name: string, brand: string, category: string, tags?: string[]): string[] {
  const tokens = new Set<string>();
  
  // Add individual words from name, brand, category, and tags
  const allText = [name, brand, category, ...(tags || [])]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  allText.forEach(word => {
    tokens.add(word);
    // Add partial matches
    for (let i = 3; i <= word.length; i++) {
      tokens.add(word.substring(0, i));
    }
  });
  
  return Array.from(tokens);
}

// Helper function to generate SEO slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 60);
}

// Helper function to generate SEO keywords
function generateKeywords(data: Partial<Product>): string[] {
  const keywords = new Set<string>();
  
  if (data.name) {
    keywords.add(data.name.toLowerCase());
    data.name.split(' ').forEach(word => {
      if (word.length > 3) keywords.add(word.toLowerCase());
    });
  }
  
  if (data.brand) keywords.add(data.brand.toLowerCase());
  if (data.category) keywords.add(data.category.toLowerCase());
  if (data.subcategory) keywords.add(data.subcategory.toLowerCase());
  if (data.gender) keywords.add(data.gender);
  if (data.color) keywords.add(data.color.toLowerCase());
  if (data.material) keywords.add(data.material.toLowerCase());
  
  if (data.tags) {
    data.tags.forEach(tag => keywords.add(tag.toLowerCase()));
  }
  
  // Add common sneaker-related keywords
  keywords.add('sneakers');
  keywords.add('shoes');
  keywords.add('footwear');
  
  return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
}

// Track product view
export async function trackProductView(productId: string, userId?: string): Promise<void> {
  try {
    const productRef = productsCollection.doc(productId);
    await productRef.update({
      views: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    // Track user behavior if userId provided
    if (userId) {
      // This would integrate with analytics service
      console.log(`User ${userId} viewed product ${productId}`);
    }
  } catch (error) {
    console.error('Error tracking product view:', error);
  }
}

// Update product rating
export async function updateProductRating(productId: string, newRating: number, reviewCount: number): Promise<void> {
  try {
    await productsCollection.doc(productId).update({
      rating: newRating,
      reviewCount,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    await invalidateCache();
  } catch (error) {
    console.error('Error updating product rating:', error);
    throw new Error('Failed to update product rating');
  }
}

// Update product sales count
export async function updateProductSales(productId: string, quantity: number): Promise<void> {
  try {
    await productsCollection.doc(productId).update({
      totalSold: admin.firestore.FieldValue.increment(quantity),
      updatedAt: admin.firestore.Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating product sales:', error);
  }
}

// Update wishlist count
export async function updateWishlistCount(productId: string, increment: boolean): Promise<void> {
  try {
    await productsCollection.doc(productId).update({
      wishlistCount: admin.firestore.FieldValue.increment(increment ? 1 : -1),
      updatedAt: admin.firestore.Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating wishlist count:', error);
  }
}

// Get products by status
export async function getProductsByStatus(status: Product['status'], limit: number = 50): Promise<Product[]> {
  try {
    const cacheKeyStr = cacheKey('products', { status, limit: limit.toString() });
    const cached = await getCache<Product[]>(cacheKeyStr);
    if (cached) return cached;

    const snapshot = await productsCollection
      .where('status', '==', status)
      .limit(limit)
      .get();

    const products = snapshot.docs.map(transformProductData);
    await setCache(cacheKeyStr, products, 300); // 5 minutes
    
    return products;
  } catch (error) {
    console.error('Error getting products by status:', error);
    throw new Error('Failed to get products by status');
  }
}

// Get trending products (high views, recent sales)
export async function getTrendingProducts(limit: number = 12): Promise<Product[]> {
  try {
    const cacheKeyStr = cacheKey('products', { type: 'trending', limit: limit.toString() });
    const cached = await getCache<Product[]>(cacheKeyStr);
    if (cached) return cached;

    // Get products with high views in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshot = await productsCollection
      .where('status', '==', 'active')
      .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .orderBy('views', 'desc')
      .limit(limit)
      .get();

    const products = snapshot.docs.map(transformProductData);
    await setCache(cacheKeyStr, products, 600); // 10 minutes
    
    return products;
  } catch (error) {
    console.error('Error getting trending products:', error);
    throw new Error('Failed to get trending products');
  }
}
