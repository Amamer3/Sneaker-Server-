import { Response } from 'express';
import { CartService } from '../services/cartService';
import * as productService from '../services/productService';
import { AuthRequest } from '../middleware/auth';
import { Cart, CartItem } from '../models/Cart';
import { Product } from '../models/Product';

const cartService = new CartService();

type EnrichedCartItem = CartItem & { product: Product | null };
type EnrichedCart = Omit<Cart, 'items'> & { items: EnrichedCartItem[] };

async function enrichCartWithProductDetails(cart: Cart | null): Promise<EnrichedCart | null> {
  if (!cart) return null;

  try {
    // Get all product details in parallel
    const productPromises = cart.items.map(async item => {
      try {
        return await productService.getProduct(item.productId);
      } catch (error) {
        console.error(`Error fetching product ${item.productId}:`, error);
        return null;
      }
    });
    
    const products = await Promise.all(productPromises);
    
    // Attach product details to each cart item
    const enrichedCart: EnrichedCart = {
      ...cart,
      items: cart.items.map((item, index) => ({
        ...item,
        product: products[index] || null
      }))
    };
    
    return enrichedCart;
  } catch (error) {
    console.error('Error enriching cart:', error);
    // Return a basic cart structure if enrichment fails
    return {
      ...cart,
      items: cart.items.map(item => ({
        ...item,
        product: null
      }))
    };
  }
}

const emptyCart: EnrichedCart = {
  id: '',
  userId: '',
  items: [],
  total: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const getUserCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Handle unauthenticated requests with an empty cart
    if (!userId) {
      return res.json(emptyCart);
    }

    try {
      const cart = await cartService.getCart(userId);
      
      if (!cart) {
        // Return empty cart if none exists
        return res.json(emptyCart);
      }

      const enrichedCart = await enrichCartWithProductDetails(cart);
      return res.json(enrichedCart || emptyCart);

    } catch (cartError) {
      console.error('Error getting or enriching cart:', cartError);
      // Return empty cart in case of any error
      return res.json(emptyCart);
    }
  } catch (error) {
    console.error('Error in getUserCart:', error);
    res.status(500).json({ 
      message: 'Error processing request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity = 1, size } = req.body;
    const userId = req.user?.id; // Optional user ID

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // If user is not authenticated, just return the cart data
    if (!userId) {
      return res.json({
        success: true,
        item: { productId, quantity, size }
      });
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

export const syncCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items must be an array' });
    }

    // Get current cart
    let cart = await cartService.getCart(userId);

    // If no existing cart, create one with the provided items
    if (!cart) {
      cart = await cartService.createCart(userId, items);
    } else {
      // Merge local items with server cart
      for (const item of items) {
        const existingItem = cart.items.find(i => i.productId === item.productId && i.size === item.size);
        if (existingItem) {
          // Update quantity if item exists
          existingItem.quantity += item.quantity;
        } else {
          // Add new item
          cart.items.push(item);
        }
      }
      // Update cart with merged items
      cart = await cartService.updateCart(userId, cart.items);
    }

    const enrichedCart = await enrichCartWithProductDetails(cart);
    res.json(enrichedCart);
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ message: 'Error syncing cart', error });
  }
};
