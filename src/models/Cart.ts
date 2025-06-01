export interface CartItem {
  id: string;
  productId: string;
  size?: string;
  quantity: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}
