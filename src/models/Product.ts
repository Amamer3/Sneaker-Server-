export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  category: string;
  sizes: string[];
  images: {
    id: string;
    url: string;
    order: number;
  }[]; // Update images to be an array of objects
  inStock: boolean;
  stock: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
