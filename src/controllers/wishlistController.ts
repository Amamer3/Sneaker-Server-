import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WishlistService } from '../services/wishlistService';
import * as productService from '../services/productService';

const wishlistService = new WishlistService();

const formatError = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return process.env.NODE_ENV === 'development' ? error.message : undefined;
  }
  return undefined;
};

export const getUserWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const enrichedWishlist = await wishlistService.getEnrichedWishlist(userId);
    
    if (!enrichedWishlist) {
      return res.json({ 
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Filter out items with deleted products
    const validItems = enrichedWishlist.items.filter(item => item.product !== null);

    res.json({
      items: validItems,
      total: validItems.length,
      createdAt: enrichedWishlist.createdAt,
      updatedAt: enrichedWishlist.updatedAt
    });
  } catch (error) {
    console.error('Error in getUserWishlist:', error);
    res.status(500).json({ 
      message: 'Error fetching wishlist',
      error: formatError(error)
    });
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
    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const wishlist = await wishlistService.addToWishlist(userId, productId);
    const enrichedWishlist = await wishlistService.getEnrichedWishlist(userId);

    res.json({
      message: 'Product added to wishlist',
      wishlist: enrichedWishlist
    });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    res.status(500).json({ 
      message: 'Error adding to wishlist',
      error: formatError(error)
    });
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

    const enrichedWishlist = await wishlistService.getEnrichedWishlist(userId);

    res.json({
      message: 'Product removed from wishlist',
      wishlist: enrichedWishlist
    });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({ 
      message: 'Error removing from wishlist',
      error: formatError(error)
    });
  }
};

export const clearWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await wishlistService.clearWishlist(userId);

    res.json({
      message: 'Wishlist cleared',
      wishlist: {
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error in clearWishlist:', error);
    res.status(500).json({ 
      message: 'Error clearing wishlist',
      error: formatError(error)
    });
  }
};
