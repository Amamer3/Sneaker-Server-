export interface Cart {
  id: string;
  userId: string;
  items: {
    productId: string;
    size: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}
