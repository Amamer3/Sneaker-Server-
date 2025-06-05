export interface ProductImage {
  id: string;
  url: string;
  order: number;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images: ProductImage[];
  inStock: boolean;
  stock: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  searchTokens?: string[];
}
