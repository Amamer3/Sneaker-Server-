import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { TimeFrame } from '../types/analytics';
import { ValidatedAnalyticsQuery } from '../middleware/validation/analytics';

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
    res.status(500).json({ error: 'Failed to retrieve revenue statistics' });
  }
};

// Order Analytics
export const getOrderStats = async (req: Request & { analyticsQuery?: ValidatedAnalyticsQuery }, res: Response) => {
  try {
    const { startDate, endDate } = req.analyticsQuery || {};
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
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await analyticsService.getProductsByCategory(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting products by category:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve product category statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Customer Analytics
export const getCustomerStats = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const stats = await analyticsService.getCustomerStats(limit);
    res.json(stats);
  } catch (error) {
    console.error('Error getting customer stats:', error);
    res.status(500).json({ error: 'Failed to retrieve customer statistics' });
  }
};
