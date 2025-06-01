import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Product } from '../models/Product';
import { WishlistService } from '../services/wishlistService';
import * as productService from '../services/productService';

const wishlistService = new WishlistService();

export const getUserWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const wishlist = await wishlistService.getWishlist(userId);
    
    if (!wishlist) {
      return res.json({ items: [] });
    }

    // Get product details for each product in wishlist
    const products = await Promise.all(
      wishlist.productIds.map(id => productService.getProduct(id))
    );

    // Filter out any null products (in case some were deleted)
    const validProducts = products.filter((product: Product | null): product is Product => product !== null);

    res.json({ items: validProducts });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching wishlist', error });
  }
};

export const addToWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Verify product exists
    const product = await productService.getProduct(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const wishlist = await wishlistService.addToWishlist(userId, productId);
    res.json({ message: 'Product added to wishlist', wishlist });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to wishlist', error });
  }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId } = req.params;

    const wishlist = await wishlistService.removeFromWishlist(userId, productId);
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    res.json({ message: 'Product removed from wishlist', wishlist });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from wishlist', error });
  }
};

export const clearWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await wishlistService.clearWishlist(userId);
    res.json({ message: 'Wishlist cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing wishlist', error });
  }
};
