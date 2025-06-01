export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images: string[];
  inStock: boolean;
  stock: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
