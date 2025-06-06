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
}
