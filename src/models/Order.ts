export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  zipCode: string;
  phone: string;  // Add phone to address interface
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface ShippingInfo {
  name: string;
  email: string;
  phone: string;
  address: Address;
  city?: string;
  state?: string;
  country?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  totalAmount: number;  // For backward compatibility
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
  shippingAddress: Address;
  shipping: ShippingInfo;
  user: UserInfo;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  name?: string;
  price: number;
  image?: string;
}

export interface CreateOrderInput {
  items: CreateOrderItemInput[];
  shippingAddress: Address & { phone: string };  // Ensure phone is required
  total?: number;
}

export interface UpdateOrderStatusInput {
  status: Order['status'];
}

export interface OrderQueryOptions {
  page?: number;
  limit?: number;
  status?: Order['status'];
  sortBy?: 'createdAt' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}
