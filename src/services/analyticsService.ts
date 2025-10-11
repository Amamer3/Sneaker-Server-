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
import * as FirebaseFirestore from 'firebase-admin/firestore';

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
  private ordersCollection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;
  private productsCollection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;
  private usersCollection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;

  constructor() {
    this.ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);
    this.productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);
    this.usersCollection = FirestoreService.collection(COLLECTIONS.USERS);
  }

  async getOverviewStats(startDate?: Date, endDate?: Date): Promise<OverviewStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-overview', { startDate, endDate });
      const cached = await getCache<OverviewStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached overview stats');
        return cached;
      }

      Logger.debug('Calculating fresh overview stats');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const defaultStats = { ...DEFAULT_STATS };
      
      // Create date range for filtering
      const queryEndDate = endDate || new Date();
      const queryStartDate = startDate || new Date(queryEndDate);
      queryStartDate.setDate(queryStartDate.getDate() - 30); // Default to last 30 days if no start date

      // Get orders in date range
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.ordersCollection;
      query = query.where('createdAt', '>=', queryStartDate);
      query = query.where('createdAt', '<=', queryEndDate);
      const orders = await query.get();

      // Get users in date range
      let usersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.usersCollection;
      usersQuery = usersQuery.where('createdAt', '>=', queryStartDate);
      usersQuery = usersQuery.where('createdAt', '<=', queryEndDate);
      const users = await usersQuery.get();

      // Calculate totals for the period
      let totalRevenue = 0;
      let todayRevenue = 0;
      orders.forEach(doc => {
        const order = doc.data();
        const orderDate = order.createdAt?.toDate();
        if (orderDate) {
          const amount = order.totalAmount || 0;
          totalRevenue += amount;
          if (orderDate.toDateString() === today.toDateString()) {
            todayRevenue += amount;
          }
        }
      });

      // Calculate metrics
      const stats = {
        ...defaultStats,
        totalRevenue,
        totalOrders: orders.size,
        totalCustomers: users.size,
        todayRevenue,
        todayOrders: orders.docs.filter(doc => 
          doc.data().createdAt?.toDate()?.toDateString() === today.toDateString()
        ).length,
        todayNewCustomers: users.docs.filter(doc => 
          doc.data().createdAt?.toDate()?.toDateString() === today.toDateString()
        ).length,
      };

      // Cache the results
      await setCache(cacheKeyStr, stats, 300); // Cache for 5 minutes
      return stats;
    } catch (error) {
      Logger.error('Error calculating overview stats:', error);
      throw error;
    }
  } 

  async calculateTotalRevenue(): Promise<number> {
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

  async calculateTotalOrders(): Promise<number> {
    try {
      const snapshot = await this.ordersCollection.count().get();
      return snapshot.data().count;
    } catch (error) {
      Logger.error('Error calculating total orders:', error);
      return 0;
    }
  }

  async calculateTotalCustomers(): Promise<number> {
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.ordersCollection;
      query = query.where('createdAt', '>=', today);
      const orders = await query.get();
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.ordersCollection;
      query = query.where('createdAt', '>=', today);
      const orders = await query.get();
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.usersCollection;
      query = query.where('createdAt', '>=', today);
      const users = await query.get();
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

      let ordersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.ordersCollection;
      ordersQuery = ordersQuery.where('createdAt', '>=', yesterday);
      ordersQuery = ordersQuery.where('createdAt', '<', today);
      
      let usersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.usersCollection;
      usersQuery = usersQuery.where('createdAt', '>=', yesterday);
      usersQuery = usersQuery.where('createdAt', '<', today);
      
      const [orders, users] = await Promise.all([
        ordersQuery.get(),
        usersQuery.get()
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.productsCollection;
      query = query.orderBy('totalSales', 'desc').limit(limit);
      const productsSnapshot = await query.get();

      const topProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        sales: doc.data().totalSales || 0,
        revenue: doc.data().totalRevenue || 0
      }));

      // Get products with low stock
      let lowStockQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.productsCollection;
      lowStockQuery = lowStockQuery.where('stock', '<', 10);  // Define low stock as less than 10 items
      const lowStockSnapshot = await lowStockQuery.get();

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
  async getOrderStats(startDate?: Date, endDate?: Date): Promise<OrderStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-orders', { startDate, endDate });
      const cached = await getCache<OrderStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached order stats');
        return cached;
      }

      Logger.debug('Calculating fresh order stats');
      
      // Create date range for filtering
      const queryEndDate = endDate || new Date();
      const queryStartDate = startDate || new Date(queryEndDate);
      queryStartDate.setDate(queryStartDate.getDate() - 30); // Default to last 30 days if no start date
      
      // Build query with date filters
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.ordersCollection;
      if (startDate) {
        query = query.where('createdAt', '>=', queryStartDate);
      }
      if (endDate) {
        query = query.where('createdAt', '<=', queryEndDate);
      }
      
      const ordersSnapshot = await query.get();
      
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
  async getRevenueStats(timeframe: TimeFrame = 'monthly', startDate?: Date, endDate?: Date): Promise<RevenueStats> {
    try {
      const cacheKeyStr = cacheKey('analytics-revenue', { timeframe, startDate, endDate });
      const cached = await getCache<RevenueStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached revenue stats');
        return cached;
      }

      Logger.debug('Calculating fresh revenue stats');

      // Create date range for filtering
      const queryEndDate = endDate || new Date();
      const queryStartDate = startDate || new Date(queryEndDate);
      queryStartDate.setDate(queryStartDate.getDate() - 30); // Default to last 30 days if no start date

      // Get orders in date range
      const orders = await this.ordersCollection
        .where('createdAt', '>=', queryStartDate)
        .where('createdAt', '<=', queryEndDate)
        .get();

      // Process orders based on timeframe
      const revenueData: Record<string, number> = {};
      const timePeriods: string[] = [];

      orders.forEach(doc => {
        const order = doc.data();
        const orderDate = order.createdAt?.toDate();
        if (!orderDate) return;

        let periodKey = '';
        switch (timeframe) {
          case 'yearly':
            periodKey = orderDate.getFullYear().toString();
            break;
          case 'quarterly':
            periodKey = `${orderDate.getFullYear()}-Q${Math.floor(orderDate.getMonth() / 3) + 1}`;
            break;
          case 'monthly':
            periodKey = `${orderDate.getFullYear()}-${(orderDate.getMonth() + 1).toString().padStart(2, '0')}`;
            break;
          case 'weekly':
            const week = Math.floor((orderDate.getTime() - queryStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
            periodKey = `Week ${week + 1}`;
            break;
          case 'daily':
            periodKey = orderDate.toISOString().split('T')[0];
            break;
          case 'hourly':
            periodKey = `${orderDate.toISOString().split('T')[0]} ${orderDate.getHours()}:00`;
            break;
        }

        if (!revenueData[periodKey]) {
          revenueData[periodKey] = 0;
          timePeriods.push(periodKey);
        }
        revenueData[periodKey] += order.totalAmount || 0;
      });

      // Sort time periods
      timePeriods.sort();

      // Format the results
      const stats: RevenueStats = {
        timeframe,
        data: timePeriods.map(period => ({
          date: period,
          revenue: revenueData[period] || 0,
          orderCount: 0 // You might want to calculate this if you have order count data
        })),
        comparison: {
          previousPeriod: 0, // You should calculate this based on previous period data
          percentageChange: 0 // You should calculate this based on previous period data
        }
      };

      // Cache the results
      await setCache(cacheKeyStr, stats, 300); // Cache for 5 minutes
      return stats;
    } catch (error) {
      Logger.error('Error calculating revenue stats:', error);
      throw error;
    }
  }

  async getCustomerStats(limit: number = 10): Promise<CustomerStats> {
    try {
      // Validate limit parameter
      if (isNaN(limit) || limit <= 0) {
        throw new Error('Limit must be a positive number');
      }
      
      const cacheKeyStr = cacheKey('analytics-customers', { limit });
      const cached = await getCache<CustomerStats>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached customer stats');
        return cached;
      }

      Logger.debug('Calculating fresh customer stats');

      // Get all users
      let usersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.usersCollection;
      const usersSnapshot = await usersQuery.get();
      
      // Calculate new vs returning customers (based on orderCount)
      const newVsReturning = {
        new: 0,
        returning: 0
      };

      // Get all orders for customer analysis
      let ordersQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.ordersCollection;
      const ordersSnapshot = await ordersQuery.get();
      const customerOrders: { [customerId: string]: { count: number; total: number } } = {};
      
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const customerId = data.userId;
        if (customerId) {
          if (!customerOrders[customerId]) {
            customerOrders[customerId] = { count: 0, total: 0 };
          }
          customerOrders[customerId].count++;
          
          // Ensure totalAmount is a number
          const totalAmount = typeof data.totalAmount === 'number' ? 
            data.totalAmount : 
            parseFloat(data.totalAmount || '0');
            
          if (!isNaN(totalAmount)) {
            customerOrders[customerId].total += totalAmount;
          }
        }
      });

      // Process customer data
      const customerData: Array<{
        id: string;
        name: string;
        totalSpent: number;
        orderCount: number;
      }> = [];

      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const orders = customerOrders[doc.id] || { count: 0, total: 0 };
        
        if (orders.count === 1) {
          newVsReturning.new++;
        } else if (orders.count > 1) {
          newVsReturning.returning++;
        }

        customerData.push({
          id: doc.id,
          name: data.name || 'Unknown',
          totalSpent: orders.total,
          orderCount: orders.count
        });
      });

      // Sort customers by total spent
      customerData.sort((a, b) => b.totalSpent - a.totalSpent);

      // Get top N customers
      const topCustomers = customerData.slice(0, limit);

      const stats: CustomerStats = {
        newVsReturning,
        topCustomers,
        growth: {
          rate: 0, // You should calculate the actual growth rate
          trend: [] // You should populate this with actual trend data
        }
      };

      await setCache(cacheKeyStr, stats, 3600); // Cache for 1 hour
      return stats;
    } catch (error) {
      Logger.error('Error getting customer stats:', error);
      // Throw the error so it can be properly handled by the controller
      throw error;
    }
  }

  async getProductsByCategory(startDate?: Date, endDate?: Date): Promise<{ [category: string]: number }> {
    try {
      const cacheKeyStr = cacheKey('analytics-products-category', { 
        startDate: startDate ? startDate.toISOString() : null, 
        endDate: endDate ? endDate.toISOString() : null 
      });
      const cached = await getCache<{ [category: string]: number }>(cacheKeyStr);
      if (cached) {
        Logger.debug('Using cached products by category');
        return cached;
      }

      Logger.debug('Calculating fresh products by category');

      // Build Firestore query with optional date range filtering if dates provided
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = this.productsCollection;
      
      // Only apply date filters if the createdAt field exists in the documents
      if (startDate) {
        // First check if the document has a createdAt field
        query = query.where('createdAt', '!=', null);
        query = query.where('createdAt', '>=', startDate);
      }
      
      if (endDate) {
        // If we haven't already added the createdAt != null check
        if (!startDate) {
          query = query.where('createdAt', '!=', null);
        }
        query = query.where('createdAt', '<=', endDate);
      }

      const productsSnapshot = await query.get();
      const categoryDistribution: { [key: string]: number } = {};

      productsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const category = data.category || 'Uncategorized';
        categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      });

      await setCache(cacheKeyStr, categoryDistribution, 3600); // Cache for 1 hour
      return categoryDistribution;
    } catch (error) {
      Logger.error('Error getting products by category:', error);
      // Throw the error so it can be properly handled by the controller
      throw error;
    }
  }
}
