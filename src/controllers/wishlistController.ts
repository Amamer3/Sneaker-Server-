import { Request, Response } from 'express';

export const getUserWishlist = async (req: Request, res: Response) => {
  res.send('Get user wishlist');
};

export const addToWishlist = async (req: Request, res: Response) => {
  res.send('Add to wishlist');
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  res.send('Remove from wishlist');
};
