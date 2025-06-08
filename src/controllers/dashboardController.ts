import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import * as orderService from '../services/orderService';
import { Order } from '../models/Order';

const analyticsService = new AnalyticsService();

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  revenueGrowth: string;
  ordersGrowth: string;
  productsGrowth: string;
  customersGrowth: string;
}

interface FormattedOrder {
  id: string;
  total: number;
  status: string;
  createdAt: Date;
  customer: {
    name: string;
    email: string;
  };
  items: Order['items'];
  shippingAddress: Order['shippingAddress'];
  paymentMethod: string;
}

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [overviewStats, productStats] = await Promise.all([
      analyticsService.getOverviewStats(),
      analyticsService.getProductStats()
    ]);

    // Format stats according to frontend expectations
    const stats: DashboardStats = {
      totalRevenue: overviewStats.totalRevenue,
      totalOrders: overviewStats.totalOrders,
      totalProducts: productStats.totalProducts,
      totalCustomers: overviewStats.totalCustomers,
      revenueGrowth: `${overviewStats.percentageChanges.revenue}%`,
      ordersGrowth: `${overviewStats.percentageChanges.orders}%`,
      productsGrowth: '0%', // We don't track product growth yet
      customersGrowth: `${overviewStats.percentageChanges.customers}%`
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    
    const orders = await orderService.getRecentOrders(limit);
      // Transform orders to match the expected format
    const formattedOrders: FormattedOrder[] = orders.map(order => ({
      id: order.id,
      total: order.total || order.totalAmount || 0,
      status: order.status,
      createdAt: order.createdAt,
      customer: {
        name: order.shipping?.name || order.shippingAddress.city ? `${order.shippingAddress.city} Customer` : 'Unknown',
        email: order.shipping?.email || 'No email'
      },
      items: order.items,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod || 'paystack'
    }));

    res.json({ orders: formattedOrders });
  } catch (error) {
    console.error('Error getting recent orders:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve recent orders',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
