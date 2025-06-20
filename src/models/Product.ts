export interface ProductImage {
  id: string;
  url: string;
  order: number;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  alt?: string;
}

export interface ProductVariant {
  size: string;
  stock: number;
  sku?: string;
  price?: number; // Optional variant-specific pricing
}

export interface ProductSEO {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  slug?: string;
}

export interface ProductReview {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  verified: boolean;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  originalPrice?: number; // For sale pricing
  category: string;
  subcategory?: string;
  sizes: string[];
  variants?: ProductVariant[]; // Enhanced size/stock management
  images: ProductImage[];
  inStock: boolean;
  stock: number;
  lowStockThreshold?: number;
  featured: boolean;
  onSale?: boolean;
  salePrice?: number;
  tags?: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  material?: string;
  color?: string;
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  ageGroup?: 'adult' | 'kids' | 'infant';
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'all-season';
  rating?: number;
  reviewCount?: number;
  totalSold?: number;
  views?: number;
  wishlistCount?: number;
  seo?: ProductSEO;
  status: 'active' | 'inactive' | 'discontinued';
  createdAt: Date;
  updatedAt: Date;
  searchTokens?: string[];
}
