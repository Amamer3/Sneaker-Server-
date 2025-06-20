export interface Address {
  id?: string;
  type: 'home' | 'work' | 'other';
  name?: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  phone?: string;
  isDefault?: boolean;
}

export interface UserPreferences {
  newsletter: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
  currency: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  sizePreference?: string;
  brandPreferences?: string[];
  categoryPreferences?: string[];
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  avatar?: string;
  bio?: string;
}

export interface UserAnalytics {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  favoriteCategories: string[];
  favoriteBrands: string[];
  loginCount: number;
  lastLoginAt?: Date;
  accountAge: number; // in days
  lifetimeValue: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin' | 'moderator';
  profile?: UserProfile;
  addresses?: Address[];
  preferences: UserPreferences;
  analytics?: UserAnalytics;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  password?: string; // Add optional password field
}
