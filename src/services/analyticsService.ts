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

// Cache TTL for different metric types (in seconds)
const CACHE_TTL = {
  OVERVIEW: 300,    // 5 minutes
  REVENUE: 1800,    // 30 minutes
  ORDERS: 900,      // 15 minutes
  PRODUCTS: 3600,   // 1 hour
  CUSTOMERS: 3600   // 1 hour
};

export class AnalyticsService {
  private ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);
  private productsCollection = FirestoreService.collection(COLLECTIONS.PRODUCTS);
  private usersCollection = FirestoreService.collection(COLLECTIONS.USERS);

  async getOverviewStats(): Promise<OverviewStats> {
    const cacheKeyStr = cacheKey('analytics-overview', {});
    const cached = await getCache<OverviewStats>(cacheKeyStr);
    if (cached) return cached;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalRevenue,
      totalOrders,
      totalCustomers,
      todayRevenue,
      todayOrders,
      todayNewCustomers
    ] = await Promise.all([
      this.calculateTotalRevenue(),
      this.calculateTotalOrders(),
      this.calculateTotalCustomers(),
      this.calculateTodayRevenue(),
      this.calculateTodayOrders(),
      this.calculateTodayNewCustomers()
    ]);

    const yesterdayStats = await this.getYesterdayStats();

    const stats: OverviewStats = {
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

    await setCache(cacheKeyStr, stats);
    return stats;
  }

  async getRevenueStats(timeframe: TimeFrame, startDate?: Date, endDate?: Date): Promise<RevenueStats> {
    const cacheKeyStr = cacheKey('analytics-revenue', { timeframe, startDate, endDate });
    const cached = await getCache<RevenueStats>(cacheKeyStr);
    if (cached) return cached;

    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = this.getDateRangeForTimeframe(timeframe);
    }

    const { startDate: start, endDate: end } = dateRange;
    const previousStartDate = startDate ? 
      new Date(start.getTime() - (end.getTime() - start.getTime())) : 
      this.getPreviousPeriodStartDate(start, timeframe);

    const orders = await this.ordersCollection
      .where('createdAt', '>=', previousStartDate)
      .where('createdAt', '<=', end)
      .get();

    const currentPeriodData = this.aggregateRevenueData(
      orders.docs.filter(doc => doc.data().createdAt >= start),
      timeframe
    );

    const previousPeriodRevenue = this.calculateTotalRevenueFromOrders(
      orders.docs.filter(doc => doc.data().createdAt < start)
    );

    const stats: RevenueStats = {
      timeframe: startDate ? 'custom' : timeframe,
      data: currentPeriodData,
      comparison: {
        previousPeriod: previousPeriodRevenue,
        percentageChange: this.calculatePercentageChange(
          this.calculateTotalRevenueFromData(currentPeriodData),
          previousPeriodRevenue
        )
      }
    };

    await setCache(cacheKeyStr, stats);
    return stats;
  }

  async getOrderStats(): Promise<OrderStats> {
    const cacheKeyStr = cacheKey('analytics-orders', {});
    const cached = await getCache<OrderStats>(cacheKeyStr);
    if (cached) return cached;

    const orders = await this.ordersCollection.get();

    const orderDocs = orders.docs;
    const statusDistribution: { [key: string]: number } = {};
    let totalValue = 0;

    orderDocs.forEach(doc => {
      const data = doc.data();
      statusDistribution[data.status] = (statusDistribution[data.status] || 0) + 1;
      totalValue += data.total;
    });

    const stats: OrderStats = {
      statusDistribution,
      averageOrderValue: totalValue / (orderDocs.length || 1),
      orderTrends: this.aggregateOrderTrends(orderDocs, 'daily')
    };

    await setCache(cacheKeyStr, stats);
    return stats;
  }

  async getProductStats(limit: number = 10): Promise<ProductStats> {
    const cacheKeyStr = cacheKey('analytics-products', { limit });
    const cached = await getCache<ProductStats>(cacheKeyStr);
    if (cached) return cached;

    const [products, orders] = await Promise.all([
      this.productsCollection.get(),
      this.ordersCollection.get()
    ]);

    const productSales: { [key: string]: { sales: number; revenue: number } } = {};
    orders.docs.forEach(doc => {
      const order = doc.data();
      order.items.forEach((item: any) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { sales: 0, revenue: 0 };
        }
        productSales[item.productId].sales += item.quantity;
        productSales[item.productId].revenue += item.price * item.quantity;
      });
    });

    const categoryDistribution: { [key: string]: number } = {};
    const productMap = new Map();

    products.docs.forEach(doc => {
      const product = doc.data();
      productMap.set(doc.id, product);
      categoryDistribution[product.category] = (categoryDistribution[product.category] || 0) + 1;
    });

    const stats: ProductStats = {
      topProducts: await this.getTopSellingProducts(limit),
      lowStock: await this.getLowStockProducts(limit),
      categoryDistribution: await this.getProductCategoryDistribution()
    };

    await setCache(cacheKeyStr, stats);
    return stats;
  }

  async getCustomerStats(limit: number = 10): Promise<CustomerStats> {
    const cacheKeyStr = cacheKey('analytics-customers', { limit });
    const cached = await getCache<CustomerStats>(cacheKeyStr);
    if (cached) return cached;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [users, orders] = await Promise.all([
      this.usersCollection.get(),
      this.ordersCollection.where('createdAt', '>=', thirtyDaysAgo).get()
    ]);

    const newCustomers = users.docs.filter(doc => doc.data().createdAt >= thirtyDaysAgo).length;
    const returningCustomers = users.docs.length - newCustomers;

    const customerOrders = new Map<string, { totalSpent: number; orderCount: number }>();
    orders.docs.forEach(doc => {
      const order = doc.data();
      if (!customerOrders.has(order.userId)) {
        customerOrders.set(order.userId, { totalSpent: 0, orderCount: 0 });
      }
      const customer = customerOrders.get(order.userId)!;
      customer.totalSpent += order.total;
      customer.orderCount += 1;
    });

    const stats: CustomerStats = {
      newVsReturning: {
        new: newCustomers,
        returning: returningCustomers
      },
      growth: {
        rate: this.calculateGrowthRate(users.docs),
        trend: this.calculateCustomerGrowthTrend(users.docs)
      },
      topCustomers: await this.getTopCustomers(customerOrders)
    };

    await setCache(cacheKeyStr, stats);
    return stats;
  }

  // Private helper methods
  private async calculateTotalRevenue(): Promise<number> {
    const orders = await this.ordersCollection.get();
    return orders.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
  }

  private async calculateTotalOrders(): Promise<number> {
    const snapshot = await this.ordersCollection.count().get();
    return snapshot.data().count;
  }

  private async calculateTotalCustomers(): Promise<number> {
    const snapshot = await this.usersCollection.count().get();
    return snapshot.data().count;
  }

  private async calculateTodayRevenue(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orders = await this.ordersCollection.where('createdAt', '>=', today).get();
    return orders.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
  }

  private async calculateTodayOrders(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orders = await this.ordersCollection.where('createdAt', '>=', today).get();
    return orders.docs.length;
  }

  private async calculateTodayNewCustomers(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const users = await this.usersCollection.where('createdAt', '>=', today).get();
    return users.docs.length;
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  }

  private getDateRangeForTimeframe(timeframe: TimeFrame): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 5);
        break;
    }

    return { startDate, endDate };
  }

  private getPreviousPeriodStartDate(startDate: Date, timeframe: TimeFrame): Date {
    const previousStartDate = new Date(startDate);
    
    switch (timeframe) {
      case 'daily':
        previousStartDate.setDate(previousStartDate.getDate() - 30);
        break;
      case 'weekly':
        previousStartDate.setDate(previousStartDate.getDate() - 90);
        break;
      case 'monthly':
        previousStartDate.setMonth(previousStartDate.getMonth() - 12);
        break;
      case 'yearly':
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 5);
        break;
    }

    return previousStartDate;
  }

  private aggregateRevenueData(docs: FirebaseFirestore.QueryDocumentSnapshot[], timeframe: TimeFrame) {
    const data: { [key: string]: { revenue: number; orderCount: number } } = {};

    docs.forEach(doc => {
      const orderData = doc.data();
      const date = this.formatDateByTimeframe(orderData.createdAt.toDate(), timeframe);
      
      if (!data[date]) {
        data[date] = { revenue: 0, orderCount: 0 };
      }
      
      data[date].revenue += orderData.total || 0;
      data[date].orderCount += 1;
    });

    return Object.entries(data).map(([date, values]) => ({
      date,
      revenue: values.revenue,
      orderCount: values.orderCount
    }));
  }

  private formatDateByTimeframe(date: Date, timeframe: TimeFrame): string {
    switch (timeframe) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return date.getFullYear().toString();
      default:
        return date.toISOString();
    }
  }

  private calculateTotalRevenueFromOrders(docs: FirebaseFirestore.QueryDocumentSnapshot[]): number {
    return docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
  }

  private calculateTotalRevenueFromData(data: Array<{ revenue: number }>): number {
    return data.reduce((sum, item) => sum + item.revenue, 0);
  }

  private aggregateOrderTrends(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    timeframe: TimeFrame
  ) {
    const trends: { [key: string]: number } = {};

    docs.forEach(doc => {
      const date = this.formatDateByTimeframe(doc.data().createdAt.toDate(), timeframe);
      trends[date] = (trends[date] || 0) + 1;
    });

    return Object.entries(trends).map(([date, count]) => ({ date, count }));
  }

  private getTopSellingProducts(limit: number) {
    return this.productsCollection
      .orderBy('sales', 'desc')
      .limit(limit)
      .get()
      .then(snapshot => {
        const products: ProductStats['topProducts'] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          products.push({
            id: doc.id,
            name: data.name,
            sales: data.sales,
            revenue: data.revenue
          });
        });
        return products;
      });
  }

  private getLowStockProducts(limit: number) {
    return this.productsCollection
      .where('stock', '<', 10)
      .limit(limit)
      .get()
      .then(snapshot => {
        const products: ProductStats['lowStock'] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          products.push({
            id: doc.id,
            name: data.name,
            stock: data.stock
          });
        });
        return products;
      });
  }

  private getProductCategoryDistribution() {
    return this.productsCollection
      .get()
      .then(snapshot => {
        const distribution: { [key: string]: number } = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          distribution[data.category] = (distribution[data.category] || 0) + 1;
        });
        return distribution;
      });
  }

  private calculateGrowthRate(docs: FirebaseFirestore.QueryDocumentSnapshot[]): number {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const currentPeriodCustomers = docs.filter(doc => 
      doc.data().createdAt >= thirtyDaysAgo
    ).length;

    const previousPeriodCustomers = docs.filter(doc => 
      doc.data().createdAt >= sixtyDaysAgo && doc.data().createdAt < thirtyDaysAgo
    ).length;

    return this.calculatePercentageChange(currentPeriodCustomers, previousPeriodCustomers);
  }

  private calculateCustomerGrowthTrend(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
    const trend: { [key: string]: number } = {};

    docs.forEach(doc => {
      const date = this.formatDateByTimeframe(doc.data().createdAt.toDate(), 'monthly');
      trend[date] = (trend[date] || 0) + 1;
    });

    return Object.entries(trend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private async getTopCustomers(
    customerOrders: Map<string, { totalSpent: number; orderCount: number }>
  ) {
    const customerData = Array.from(customerOrders.entries());
    const topCustomerIds = customerData
      .sort(([, a], [, b]) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
      .map(([id]) => id);

    const customers = await Promise.all(
      topCustomerIds.map(id => this.usersCollection.doc(id).get())
    );

    return customers.map((doc, index) => {
      const customer = doc.data();
      const orders = customerOrders.get(doc.id)!;
      return {
        id: doc.id,
        name: customer?.name || 'Anonymous',
        totalSpent: orders.totalSpent,
        orderCount: orders.orderCount
      };
    });
  }

  private async getYesterdayStats() {
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
  }
}

export const analyticsService = new AnalyticsService();
