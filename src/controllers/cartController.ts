import { Response } from 'express';
import { CartService } from '../services/cartService';
import * as productService from '../services/productService';
import { AuthRequest } from '../middleware/auth';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';

const cartService = new CartService();

async function enrichCartWithProductDetails(cart: Cart | null): Promise<(Cart & { items: Array<Cart['items'][0] & { product: Product | null }> }) | null> {
  if (!cart) return null;
  
  // Get all product details in parallel
  const products = await Promise.all(
    cart.items.map(item => productService.getProduct(item.productId))
  );
  
  // Attach product details to each cart item
  const enrichedCart: Cart & { items: Array<Cart['items'][0] & { product: Product | null }> } = {
    ...cart,
    items: cart.items.map((item, index) => ({
      ...item,
      product: products[index] || null
    }))
  };
  
  return enrichedCart;
}

export const getUserCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const cart = await cartService.getCart(userId);
    
    const enrichedCart = await enrichCartWithProductDetails(cart);
    
    res.json(enrichedCart || { items: [], total: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart', error });
  }
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId, quantity = 1, size } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Get product to verify it exists and get current price
    const product = await productService.getProduct(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const cart = await cartService.addToCart(
      userId,
      productId,
      product.price,
      quantity,
      size
    );

    const enrichedCart = await enrichCartWithProductDetails(cart);
    res.json(enrichedCart);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to cart', error });
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (typeof quantity !== 'number') {
      return res.status(400).json({ message: 'Quantity must be a number' });
    }

    const cart = await cartService.updateCartItemQuantity(userId, itemId, quantity);
    if (!cart) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const enrichedCart = await enrichCartWithProductDetails(cart);
    res.json(enrichedCart);
  } catch (error) {
    res.status(500).json({ message: 'Error updating cart item', error });
  }
};

export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { itemId } = req.params;

    const cart = await cartService.removeFromCart(userId, itemId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const enrichedCart = await enrichCartWithProductDetails(cart);
    res.json(enrichedCart);
  } catch (error) {
    res.status(500).json({ message: 'Error removing from cart', error });
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await cartService.clearCart(userId);
    res.json({ message: 'Cart cleared', items: [], total: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cart', error });
  }
};

export const processCheckout = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    // TODO: Implement checkout logic
    res.status(501).json({ message: 'Checkout not implemented yet' });
  } catch (error) {
    res.status(500).json({ message: 'Error processing checkout', error });
  }
};
