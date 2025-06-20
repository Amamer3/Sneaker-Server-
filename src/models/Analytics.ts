export interface ProductAnalytics {
  productId: string;
  views: number;
  uniqueViews: number;
  addToCartCount: number;
  purchaseCount: number;
  wishlistCount: number;
  conversionRate: number;
  averageRating: number;
  reviewCount: number;
  returnRate: number;
  revenue: number;
  date: Date;
}

export interface UserBehavior {
  userId: string;
  sessionId: string;
  action: 'view' | 'add_to_cart' | 'remove_from_cart' | 'purchase' | 'wishlist_add' | 'wishlist_remove' | 'search' | 'filter' | 'review';
  productId?: string;
  categoryId?: string;
  searchQuery?: string;
  filters?: Record<string, any>;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  location?: {
    country: string;
    city: string;
    region: string;
  };
  referrer?: string;
  timestamp: Date;
}

export interface SalesAnalytics {
  date: Date;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  conversionRate: number;
  abandonedCarts: number;
  refunds: number;
  refundAmount: number;
  topSellingProducts: {
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  topCategories: {
    category: string;
    orders: number;
    revenue: number;
  }[];
}

export interface InventoryAnalytics {
  productId: string;
  currentStock: number;
  stockMovement: number; // Positive for restocks, negative for sales
  lowStockAlert: boolean;
  outOfStockDays: number;
  turnoverRate: number;
  averageDaysToSell: number;
  seasonalTrend: 'increasing' | 'decreasing' | 'stable';
  date: Date;
}

export interface CustomerAnalytics {
  userId: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: Date;
  daysSinceLastOrder: number;
  favoriteCategory: string;
  favoriteBrand: string;
  lifetimeValue: number;
  churnRisk: 'low' | 'medium' | 'high';
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  acquisitionChannel: string;
  acquisitionDate: Date;
  updatedAt: Date;
}

export interface MarketingAnalytics {
  campaignId: string;
  campaignName: string;
  channel: 'email' | 'sms' | 'social' | 'search' | 'display' | 'affiliate';
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  clickThroughRate: number;
  conversionRate: number;
  returnOnAdSpend: number;
  customerAcquisitionCost: number;
  date: Date;
}

export interface WebsiteAnalytics {
  date: Date;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: {
    path: string;
    views: number;
    uniqueViews: number;
  }[];
  trafficSources: {
    source: string;
    visitors: number;
    percentage: number;
  }[];
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  locationBreakdown: {
    country: string;
    visitors: number;
    percentage: number;
  }[];
}

export interface SearchAnalytics {
  query: string;
  searchCount: number;
  resultsCount: number;
  clickThroughRate: number;
  conversionRate: number;
  noResultsRate: number;
  averagePosition: number;
  date: Date;
}

export interface ReviewAnalytics {
  productId: string;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  verifiedReviews: number;
  responseRate: number;
  sentimentScore: number; // -1 to 1, where 1 is most positive
  date: Date;
}