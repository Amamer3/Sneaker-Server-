import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import * as orderService from '../services/orderService';

const analyticsService = new AnalyticsService();

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [overviewStats, productStats, orderStats] = await Promise.all([
      analyticsService.getOverviewStats(),
      analyticsService.getProductStats(5), // Get top 5 products
      analyticsService.getOrderStats()
    ]);

    const dashboardStats = {
      revenue: {
        total: overviewStats.totalRevenue,
        today: overviewStats.todayRevenue,
        change: overviewStats.percentageChanges.revenue
      },
      orders: {
        total: overviewStats.totalOrders,
        today: overviewStats.todayOrders,
        change: overviewStats.percentageChanges.orders,
        status: orderStats.statusDistribution
      },
      customers: {
        total: overviewStats.totalCustomers,
        today: overviewStats.todayNewCustomers,
        change: overviewStats.percentageChanges.customers
      },
      topProducts: productStats.topProducts,
      lowStock: productStats.lowStock
    };

    res.json(dashboardStats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
};

export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const page = 1; // Always get first page for recent orders
    const limit = parseInt(req.query.limit as string) || 10;
    
    const { orders, total } = await orderService.getAllOrders(page, limit);
    
    res.json({
      orders,
      total,
      hasMore: limit < total
    });
  } catch (error) {
    console.error('Error getting recent orders:', error);
    res.status(500).json({ error: 'Failed to retrieve recent orders' });
  }
};
