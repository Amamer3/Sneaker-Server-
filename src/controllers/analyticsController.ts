import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { TimeFrame } from '../types/analytics';

const analyticsService = new AnalyticsService();

// Overview Analytics
export const getOverviewStats = async (req: Request, res: Response) => {
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

    const stats = await analyticsService.getOverviewStats();
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
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as TimeFrame) || 'monthly';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const stats = await analyticsService.getRevenueStats(timeframe, startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting revenue stats:', error);
    res.status(500).json({ error: 'Failed to retrieve revenue statistics' });
  }
};

// Order Analytics
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const stats = await analyticsService.getOrderStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting order stats:', error);
    res.status(500).json({ error: 'Failed to retrieve order statistics' });
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
    const stats = await analyticsService.getProductStats();
    res.json(stats.categoryDistribution);
  } catch (error) {
    console.error('Error getting products by category:', error);
    res.status(500).json({ error: 'Failed to retrieve product category distribution' });
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
