import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { TimeFrame } from '../types/analytics';
import { ValidatedAnalyticsQuery } from '../middleware/validation/analytics';
import * as orderService from '../services/orderService';

const analyticsService = new AnalyticsService();

// Overview Analytics
export const getOverviewStats = async (req: Request & { analyticsQuery?: ValidatedAnalyticsQuery }, res: Response) => {
  try {
    // Validate user is authenticated and is admin (this is a backup check)
    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be an admin to access analytics' 
      });
      return;
    }

    const { startDate, endDate } = req.analyticsQuery || {};
    const stats = await analyticsService.getOverviewStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting overview stats:', error);
    if (error instanceof Error) {
      res.status(500).json({ 
        error: 'Failed to retrieve overview statistics',
        message: error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to retrieve overview statistics',
        message: 'An unknown error occurred' 
      });
    }
  }
};

// Revenue Analytics
export const getRevenueStats = async (req: Request & { analyticsQuery?: ValidatedAnalyticsQuery }, res: Response) => {
  try {
    const { timeframe = 'monthly', startDate, endDate } = req.analyticsQuery || {};
    const stats = await analyticsService.getRevenueStats(timeframe, startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting revenue stats:', error);
    res.status(500).json({ error: 'Failed to retrieve customer statistics' });
  }
};

// Recent Activity Analytics
export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 8;
    
    // Get recent orders
    const recentOrders = await orderService.getRecentOrders(limit);
    
    // Format the activity data
    const activities = recentOrders.map(order => ({
      id: order.id,
      type: 'order',
      title: `New Order #${order.orderNumber || order.id.slice(-6)}`,
      description: `Order placed by ${order.user?.name || 'Customer'} - $${order.total?.toFixed(2) || '0.00'}`,
      timestamp: order.createdAt,
      status: order.status,
      amount: order.total,
      customer: {
        name: order.user?.name || 'Unknown Customer',
        email: order.user?.email || 'No email'
      }
    }));
    
    res.json(activities);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({ error: 'Failed to retrieve recent activity' });
  }
};

// Order Analytics
export const getOrderStats = async (req: Request & { analyticsQuery?: ValidatedAnalyticsQuery }, res: Response) => {
  try {
    let { startDate, endDate, timeframe = 'daily' } = req.analyticsQuery || {};
    
    // If analyticsQuery is not available, try to parse from query params
    if (!req.analyticsQuery) {
      try {
        if (req.query.startDate) {
          startDate = new Date(req.query.startDate as string);
          if (isNaN(startDate.getTime())) {
            return res.status(400).json({ 
              error: 'Invalid startDate format',
              message: 'Please provide a valid date in YYYY-MM-DD format'
            });
          }
        }
        
        if (req.query.endDate) {
          endDate = new Date(req.query.endDate as string);
          if (isNaN(endDate.getTime())) {
            return res.status(400).json({ 
              error: 'Invalid endDate format',
              message: 'Please provide a valid date in YYYY-MM-DD format'
            });
          }
        }
        
        if (req.query.timeframe) {
          timeframe = req.query.timeframe as TimeFrame;
        }
      } catch (dateError) {
        return res.status(400).json({ 
          error: 'Date parsing error',
          message: 'Please provide valid dates in YYYY-MM-DD format'
        });
      }
    }
    
    const stats = await analyticsService.getOrderStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting order stats:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve order statistics',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Product Analytics
export const getProductStats = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const stats = await analyticsService.getProductStats(limit);
    res.json(stats);
  } catch (error) {
    console.error('Error getting product stats:', error);
    res.status(500).json({ error: 'Failed to retrieve product statistics' });
  }
};

export const getTopSellingProducts = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const stats = await analyticsService.getProductStats(limit);
    res.json(stats.topProducts);
  } catch (error) {
    console.error('Error getting top selling products:', error);
    res.status(500).json({ error: 'Failed to retrieve top selling products' });
  }
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const stats = await analyticsService.getProductStats(limit);
    res.json(stats.lowStock);
  } catch (error) {
    console.error('Error getting low stock products:', error);
    res.status(500).json({ error: 'Failed to retrieve low stock products' });
  }
};

export const getProductsByCategory = async (req: Request, res: Response) => {
  try {
    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;
    
    // Parse and validate date parameters
    try {
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ 
            error: 'Invalid startDate format',
            message: 'Please provide a valid date in YYYY-MM-DD format'
          });
        }
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ 
            error: 'Invalid endDate format',
            message: 'Please provide a valid date in YYYY-MM-DD format'
          });
        }
      }
    } catch (dateError) {
      return res.status(400).json({ 
        error: 'Date parsing error',
        message: 'Please provide valid dates in YYYY-MM-DD format'
      });
    }
    
    const stats = await analyticsService.getProductsByCategory(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting products by category:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve products by category',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Customer Analytics
export const getCustomerStats = async (req: Request, res: Response) => {
  try {
    // Parse and validate limit parameter
    let limit = 10;
    if (req.query.limit) {
      const parsedLimit = Number(req.query.limit);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return res.status(400).json({ 
          error: 'Invalid limit parameter',
          message: 'Limit must be a positive number'
        });
      }
      limit = parsedLimit;
    }
    
    const stats = await analyticsService.getCustomerStats(limit);
    res.json(stats);
  } catch (error) {
    console.error('Error getting customer stats:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve customer statistics',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};
