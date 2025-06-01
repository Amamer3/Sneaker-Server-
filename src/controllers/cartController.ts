import { Request, Response } from 'express';

export const getUserCart = async (req: Request, res: Response) => {
  res.send('Get user cart');
};

export const addToCart = async (req: Request, res: Response) => {
  res.send('Add to cart');
};

export const updateCartItem = async (req: Request, res: Response) => {
  res.send('Update cart item');
};

export const removeFromCart = async (req: Request, res: Response) => {
  res.send('Remove from cart');
};

export const processCheckout = async (req: Request, res: Response) => {
  res.send('Process checkout');
};
