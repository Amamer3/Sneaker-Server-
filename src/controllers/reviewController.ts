import { Request, Response } from 'express';

export const getProductReviews = async (req: Request, res: Response) => {
  res.send('Get product reviews');
};

export const addProductReview = async (req: Request, res: Response) => {
  res.send('Add product review');
};

export const updateProductReview = async (req: Request, res: Response) => {
  res.send('Update product review');
};

export const deleteProductReview = async (req: Request, res: Response) => {
  res.send('Delete product review');
};
