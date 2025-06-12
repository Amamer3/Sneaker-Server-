import { Response } from 'express';
import { CartService } from '../services/cartService';
import * as productService from '../services/productService';
import { AuthRequest } from '../middleware/auth';
import { Cart, CartItem, GuestCart } from '../models/Cart';
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
    const guestCart = req.body.guestCart as GuestCart | undefined; // Guest cart data from localStorage

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // If user is not authenticated, return data for localStorage
    if (!userId) {
      const product = await productService.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      return res.json({
        success: true,
        item: { 
          productId, 
          quantity, 
          size,
          price: product.price,
          name: product.name,
          image: product.images?.[0] // First image as preview
        }
      });
    }

    // If there's a guest cart and user just logged in, merge it
    if (guestCart && Array.isArray(guestCart.items) && guestCart.items.length > 0) {
      try {
        const cart = await cartService.convertGuestCartToStoredCart(userId, guestCart);
        const enrichedCart = await enrichCartWithProductDetails(cart);
        return res.json(enrichedCart);
      } catch (error) {
        console.error('Error converting guest cart:', error);
        // Continue with normal flow if conversion fails
      }
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

    // itemId from params is actually the productId for the cart item
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

    // itemId from params is actually the productId for the cart item
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
    const guestCart = req.body.guestCart as GuestCart;

    if (!guestCart || !Array.isArray(guestCart.items)) {
      return res.status(400).json({ message: 'Valid guest cart is required' });
    }

    try {
      const cart = await cartService.convertGuestCartToStoredCart(userId, guestCart);
      const enrichedCart = await enrichCartWithProductDetails(cart);
      return res.json(enrichedCart);
    } catch (error) {
      console.error('Error syncing guest cart:', error);
      return res.status(400).json({ 
        message: 'Failed to sync cart',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in syncCart:', error);
    res.status(500).json({ 
      message: 'Error processing request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
