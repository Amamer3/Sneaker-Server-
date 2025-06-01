export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  createdAt: Date;
  updatedAt: Date;
  password?: string; // Add optional password field
}
