/** Overview statistics for the entire store */
export interface OverviewStats {
  /** Total revenue across all time */
  totalRevenue: number;
  /** Total number of orders placed */
  totalOrders: number;
  /** Total number of unique customers */
  totalCustomers: number;
  /** Revenue generated today */
  todayRevenue: number;
  /** Number of orders placed today */
  todayOrders: number;
  /** Number of new customers registered today */
  todayNewCustomers: number;
  /** Percentage changes compared to previous period */
  percentageChanges: {
    /** Revenue change percentage */
    revenue: number;
    /** Orders change percentage */
    orders: number;
    /** New customers change percentage */
    customers: number;
  };
}

/** Revenue statistics and trends */
export interface RevenueStats {
  /** Time period for the statistics (daily/weekly/monthly/yearly) */
  timeframe: string;
  /** Revenue data points over time */
  data: Array<{
    /** Date for this data point (ISO string) */
    date: string;
    /** Total revenue for this period */
    revenue: number;
    /** Number of orders in this period */
    orderCount: number;
  }>;
  /** Comparison with previous period */
  comparison: {
    /** Total revenue from previous period */
    previousPeriod: number;
    /** Percentage change from previous period */
    percentageChange: number;
  };
}

/** Order statistics and distribution */
export interface OrderStats {
  /** Distribution of orders by status */
  statusDistribution: {
    /** Number of orders for each status */
    [status: string]: number;
  };
  /** Average value of an order */
  averageOrderValue: number;
  /** Order count trends over time */
  orderTrends: Array<{
    /** Date for this trend point (ISO string) */
    date: string;
    /** Number of orders on this date */
    count: number;
  }>;
}

/** Product performance statistics */
export interface ProductStats {
  /** Top selling products by revenue/quantity */
  topProducts: Array<{
    /** Product unique identifier */
    id: string;
    /** Product name */
    name: string;
    /** Number of units sold */
    sales: number;
    /** Total revenue generated */
    revenue: number;
  }>;
  /** Products with low stock levels */
  lowStock: Array<{
    /** Product unique identifier */
    id: string;
    /** Product name */
    name: string;
    /** Current stock level */
    stock: number;
  }>;
  /** Distribution of products by category */
  categoryDistribution: {
    /** Number of products in each category */
    [category: string]: number;
  };
}

/** Customer behavior and performance statistics */
export interface CustomerStats {
  /** New vs returning customer ratio */
  newVsReturning: {
    /** Number of new customers */
    new: number;
    /** Number of returning customers */
    returning: number;
  };
  /** Customer growth statistics */
  growth: {
    /** Growth rate percentage */
    rate: number;
    /** Customer growth trend over time */
    trend: Array<{
      /** Date for this trend point (ISO string) */
      date: string;
      /** Number of customers on this date */
      count: number;
    }>;
  };
  /** Top performing customers */
  topCustomers: Array<{
    /** Customer unique identifier */
    id: string;
    /** Customer name */
    name: string;
    /** Total amount spent */
    totalSpent: number;
    /** Total number of orders */
    orderCount: number;
  }>;
}

/** Time frame options for analytics queries */
export type TimeFrame = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** Aggregation level for data points */
export type Granularity = 'hour' | 'day' | 'week' | 'month';

/** Common analytics parameters */
export interface AnalyticsParams {
  timeframe: TimeFrame;
  startDate?: Date;
  endDate?: Date;
  granularity?: Granularity;
  limit?: number;
  includeTotal?: boolean;
  compareWithPrevious?: boolean;
}
