import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import { cacheKey, getCache, setCache } from '../utils/cache';
import {
  OverviewStats,
  RevenueStats,
  OrderStats,
  ProductStats,
  CustomerStats,
  TimeFrame
} from '../types/analytics';
import Logger from '../utils/logger';

const DEFAULT_STATS: OverviewStats = {
  totalRevenue: 0,
  totalOrders: 0,
  totalCustomers: 0,
  todayRevenue: 0,
  todayOrders: 0,
  todayNewCustomers: 0,
  percentageChanges: {
    revenue: 0,
    orders: 0,
    customers: 0
  }
};

export class AnalyticsService {
  private ordersCollection;
  private productsCollection;
  private usersCollection;

  constructor() {
    this.ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);
    this.productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);
    this.usersCollection = FirestoreService.collection(COLLECTIONS.USERS);
  }

  async getOverviewStats(): Promise<OverviewStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-overview', {});
      const cached = await getCache<OverviewStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached overview stats');
        return cached;
      }

      Logger.debug('Calculating fresh overview stats');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let stats: OverviewStats;
      try {
        const [
          totalRevenue,
          totalOrders,
          totalCustomers,
          todayRevenue,
          todayOrders,
          todayNewCustomers,
          yesterdayStats
        ] = await Promise.all([
          this.calculateTotalRevenue(),
          this.calculateTotalOrders(),
          this.calculateTotalCustomers(),
          this.calculateTodayRevenue(),
          this.calculateTodayOrders(),
          this.calculateTodayNewCustomers(),
          this.getYesterdayStats()
        ]);

        stats = {
          totalRevenue,
          totalOrders,
          totalCustomers,
          todayRevenue,
          todayOrders,
          todayNewCustomers,
          percentageChanges: {
            revenue: this.calculatePercentageChange(todayRevenue, yesterdayStats.revenue),
            orders: this.calculatePercentageChange(todayOrders, yesterdayStats.orders),
            customers: this.calculatePercentageChange(todayNewCustomers, yesterdayStats.newCustomers)
          }
        };
      } catch (error) {
        Logger.error('Error calculating overview stats:', error);
        stats = { ...DEFAULT_STATS }; // Return default stats on error
      }

      await setCache(cacheKeyStr, stats).catch(err => 
        Logger.error('Failed to cache overview stats:', err)
      );
      return stats;
    } catch (error) {
      Logger.error('Critical error in getOverviewStats:', error);
      return { ...DEFAULT_STATS };
    }
  }

  private async calculateTotalRevenue(): Promise<number> {
    try {
      const orders = await this.ordersCollection.get();
      return orders.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.total || 0);
      }, 0);
    } catch (error) {
      Logger.error('Error calculating total revenue:', error);
      return 0;
    }
  }

  private async calculateTotalOrders(): Promise<number> {
    try {
      const snapshot = await this.ordersCollection.count().get();
      return snapshot.data().count;
    } catch (error) {
      Logger.error('Error calculating total orders:', error);
      return 0;
    }
  }

  private async calculateTotalCustomers(): Promise<number> {
    try {
      const snapshot = await this.usersCollection.count().get();
      return snapshot.data().count;
    } catch (error) {
      Logger.error('Error calculating total customers:', error);
      return 0;
    }
  }

  private async calculateTodayRevenue(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const orders = await this.ordersCollection.where('createdAt', '>=', today).get();
      return orders.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.total || 0);
      }, 0);
    } catch (error) {
      Logger.error('Error calculating today revenue:', error);
      return 0;
    }
  }

  private async calculateTodayOrders(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const orders = await this.ordersCollection.where('createdAt', '>=', today).get();
      return orders.docs.length;
    } catch (error) {
      Logger.error('Error calculating today orders:', error);
      return 0;
    }
  }

  private async calculateTodayNewCustomers(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const users = await this.usersCollection.where('createdAt', '>=', today).get();
      return users.docs.length;
    } catch (error) {
      Logger.error('Error calculating today new customers:', error);
      return 0;
    }
  }

  private async getYesterdayStats() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [orders, users] = await Promise.all([
        this.ordersCollection
          .where('createdAt', '>=', yesterday)
          .where('createdAt', '<', today)
          .get(),
        this.usersCollection
          .where('createdAt', '>=', yesterday)
          .where('createdAt', '<', today)
          .get()
      ]);

      return {
        revenue: orders.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0),
        orders: orders.docs.length,
        newCustomers: users.docs.length
      };
    } catch (error) {
      Logger.error('Error getting yesterday stats:', error);
      return {
        revenue: 0,
        orders: 0,
        newCustomers: 0
      };
    }
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  }
  async getProductStats(limit: number = 10): Promise<ProductStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-products', { limit });
      const cached = await getCache<ProductStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached product stats');
        return cached;
      }

      Logger.debug('Calculating fresh product stats');
      
      // Get top products by sales
      const productsSnapshot = await this.productsCollection
        .orderBy('totalSales', 'desc')
        .limit(limit)
        .get();

      const topProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        sales: doc.data().totalSales || 0,
        revenue: doc.data().totalRevenue || 0
      }));

      // Get products with low stock
      const lowStockSnapshot = await this.productsCollection
        .where('stock', '<', 10)  // Define low stock as less than 10 items
        .get();

      const lowStock = lowStockSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        stock: doc.data().stock || 0
      }));

      // Get category distribution
      const allProductsSnapshot = await this.productsCollection.get();
      const categoryDistribution: { [category: string]: number } = {};
      allProductsSnapshot.docs.forEach(doc => {
        const category = doc.data().category;
        if (category) {
          categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
        }
      });

      const stats: ProductStats = {
        topProducts,
        lowStock,
        categoryDistribution,
        totalProducts: allProductsSnapshot.size
      };

      await setCache(cacheKeyStr, stats, 3600); // Cache for 1 hour
      return stats;
    } catch (error) {
      Logger.error('Error getting product stats:', error);
      return {
        topProducts: [],
        lowStock: [],
        categoryDistribution: {},
        totalProducts: 0
      };
    }
  }
  async getOrderStats(): Promise<OrderStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-orders', {});
      const cached = await getCache<OrderStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached order stats');
        return cached;
      }

      Logger.debug('Calculating fresh order stats');
      const ordersSnapshot = await this.ordersCollection.get();
      
      // Calculate status distribution
      const statusDistribution: { [key: string]: number } = {};
      let totalValue = 0;
      const ordersByDate: { [date: string]: number } = {};

      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Status distribution
        const status = data.status;
        statusDistribution[status] = (statusDistribution[status] || 0) + 1;

        // Calculate total value for average
        const orderValue = data.totalAmount || 0;
        totalValue += orderValue;

        // Group orders by date for trends
        const orderDate = new Date(data.createdAt.toDate()).toISOString().split('T')[0];
        ordersByDate[orderDate] = (ordersByDate[orderDate] || 0) + 1;
      });

      // Calculate average order value
      const averageOrderValue = ordersSnapshot.size > 0 
        ? totalValue / ordersSnapshot.size 
        : 0;

      // Create order trends array (last 30 days)
      const orderTrends = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        orderTrends.push({
          date: dateStr,
          count: ordersByDate[dateStr] || 0
        });
      }

      const stats: OrderStats = {
        statusDistribution,
        averageOrderValue,
        orderTrends,
        totalOrders: ordersSnapshot.size
      };

      await setCache(cacheKeyStr, stats, 900); // Cache for 15 minutes
      return stats;
    } catch (error) {
      Logger.error('Error getting order stats:', error);
      return {
        statusDistribution: {},
        averageOrderValue: 0,
        orderTrends: [],
        totalOrders: 0
      };
    }
  }
  async getRevenueStats(timeframe: TimeFrame, startDate?: Date, endDate?: Date): Promise<RevenueStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-revenue', { timeframe, startDate, endDate });
      const cached = await getCache<RevenueStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached revenue stats');
        return cached;
      }

      Logger.debug('Calculating fresh revenue stats');
      
      // Set default end date to now and start date based on timeframe
      const end = endDate || new Date();
      let start = startDate;
      if (!start) {
        start = new Date(end);
        switch(timeframe) {
          case 'daily':
            start.setDate(start.getDate() - 30); // Last 30 days
            break;
          case 'weekly':
            start.setDate(start.getDate() - 90); // Last ~13 weeks
            break;
          case 'monthly':
            start.setMonth(start.getMonth() - 12); // Last 12 months
            break;
          case 'quarterly':
            start.setMonth(start.getMonth() - 15); // Last 5 quarters
            break;
          case 'yearly':
            start.setFullYear(start.getFullYear() - 5); // Last 5 years
            break;
          default:
            start.setDate(start.getDate() - 30); // Default to last 30 days
        }
      }

      const ordersSnapshot = await this.ordersCollection
        .where('createdAt', '>=', start)
        .where('createdAt', '<=', end)
        .get();

      // Group data by time periods
      const dataByPeriod: { [key: string]: { revenue: number; orderCount: number } } = {};
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.createdAt.toDate();
        let periodKey: string;

        switch(timeframe) {
          case 'hourly':
            periodKey = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
            break;
          case 'daily':
            periodKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
            break;
          case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            periodKey = weekStart.toISOString().slice(0, 10);
            break;
          case 'monthly':
            periodKey = date.toISOString().slice(0, 7); // YYYY-MM
            break;
          case 'quarterly':
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            periodKey = `${date.getFullYear()}-Q${quarter}`;
            break;
          case 'yearly':
            periodKey = date.getFullYear().toString();
            break;
          default:
            periodKey = date.toISOString().slice(0, 10);
        }

        if (!dataByPeriod[periodKey]) {
          dataByPeriod[periodKey] = { revenue: 0, orderCount: 0 };
        }
        dataByPeriod[periodKey].revenue += data.totalAmount || 0;
        dataByPeriod[periodKey].orderCount++;
      });

      // Convert to sorted array
      const data = Object.entries(dataByPeriod)
        .map(([date, stats]) => ({
          date,
          revenue: stats.revenue,
          orderCount: stats.orderCount
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate comparison with previous period
      const totalRevenue = data.reduce((sum, point) => sum + point.revenue, 0);
      const previousPeriodStart = new Date(start);
      const periodDuration = end.getTime() - start.getTime();
      previousPeriodStart.setTime(start.getTime() - periodDuration);

      const previousPeriodSnapshot = await this.ordersCollection
        .where('createdAt', '>=', previousPeriodStart)
        .where('createdAt', '<', start)
        .get();

      const previousPeriodRevenue = previousPeriodSnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().totalAmount || 0),
        0
      );

      const percentageChange = previousPeriodRevenue !== 0
        ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

      const stats: RevenueStats = {
        timeframe,
        data,
        comparison: {
          previousPeriod: previousPeriodRevenue,
          percentageChange
        }
      };

      await setCache(cacheKeyStr, stats, 1800); // Cache for 30 minutes
      return stats;
    } catch (error) {
      Logger.error('Error getting revenue stats:', error);
      return {
        timeframe,
        data: [],
        comparison: {
          previousPeriod: 0,
          percentageChange: 0
        }
      };
    }
  }

  async getCustomerStats(limit: number = 10): Promise<CustomerStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-customers', { limit });
      const cached = await getCache<CustomerStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached customer stats');
        return cached;
      }

      Logger.debug('Calculating fresh customer stats');

      // Get all users
      const usersSnapshot = await this.usersCollection.get();
      
      // Calculate new vs returning customers (based on orderCount)
      const newVsReturning = {
        new: 0,
        returning: 0
      };

      // Get all orders for customer analysis
      const ordersSnapshot = await this.ordersCollection.get();
      const customerOrders: { [customerId: string]: { count: number; total: number } } = {};
      
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const customerId = data.userId;
        if (!customerOrders[customerId]) {
          customerOrders[customerId] = { count: 0, total: 0 };
        }
        customerOrders[customerId].count++;
        customerOrders[customerId].total += data.totalAmount || 0;
      });

      // Process customer data
      const customerData: Array<{
        id: string;
        name: string;
        totalSpent: number;
        orderCount: number;
        createdAt: Date;
      }> = [];

      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const orders = customerOrders[doc.id] || { count: 0, total: 0 };
        
        if (orders.count === 0) {
          newVsReturning.new++;
        } else {
          newVsReturning.returning++;
        }

        customerData.push({
          id: doc.id,
          name: `${data.firstName} ${data.lastName}`,
          totalSpent: orders.total,
          orderCount: orders.count,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });

      // Calculate customer growth trend (last 30 days)
      const trend: Array<{ date: string; count: number }> = [];
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        
        const count = customerData.filter(customer => 
          customer.createdAt <= date
        ).length;

        trend.push({ date: dateStr, count });
      }

      // Calculate growth rate
      const rateStart = trend[0].count;
      const rateEnd = trend[trend.length - 1].count;
      const growthRate = rateStart !== 0 
        ? ((rateEnd - rateStart) / rateStart) * 100 
        : 0;

      // Get top customers
      const topCustomers = customerData
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit)
        .map(({ id, name, totalSpent, orderCount }) => ({
          id,
          name,
          totalSpent,
          orderCount
        }));

      const stats: CustomerStats = {
        newVsReturning,
        growth: {
          rate: growthRate,
          trend
        },
        topCustomers
      };

      await setCache(cacheKeyStr, stats, 3600); // Cache for 1 hour
      return stats;
    } catch (error) {
      Logger.error('Error getting customer stats:', error);
      return {
        newVsReturning: { new: 0, returning: 0 },
        growth: {
          rate: 0,
          trend: []
        },
        topCustomers: []
      };
    }
  }
}
