export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  size: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: Address;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}
