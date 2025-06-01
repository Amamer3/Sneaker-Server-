import { Request, Response } from 'express';

export const getTopSellingProducts = async (req: Request, res: Response) => {
  res.send('Get top-selling products');
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  res.send('Get low-stock products');
};

export const getProductsByCategory = async (req: Request, res: Response) => {
  res.send('Get products by category');
};
