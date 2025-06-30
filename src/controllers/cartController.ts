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
    // For GET requests, we don't expect guestCart data since it's typically stored in localStorage
    // The frontend should handle guest cart separately
    let guestCart: GuestCart | undefined;
    
    try {
      if (req.query.guestCart && typeof req.query.guestCart === 'string') {
        guestCart = JSON.parse(req.query.guestCart) as GuestCart;
      }
    } catch (parseError) {
      console.warn('Failed to parse guestCart from query:', parseError);
      guestCart = undefined;
    }
    
    // Handle unauthenticated requests
    if (!userId) {
      // If guest cart data is provided, validate and return it
      if (guestCart && Array.isArray(guestCart.items)) {
        // Enrich guest cart items with product details
        const enrichedItems = await Promise.all(
          guestCart.items.map(async (item) => {
            const product = await productService.getProduct(item.productId);
            return {
              ...item,
              product: product || null
            };
          })
        );

        return res.json({
          items: enrichedItems,
          total: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          message: 'Guest cart retrieved successfully'
        });
      }

      // Return empty cart if no guest cart data
      return res.json({
        ...emptyCart,
        message: 'Empty guest cart'
      });
    }

    try {
      const cart = await cartService.getCart(userId);
      
      if (!cart) {
        // Return empty cart if none exists
        return res.json({
          ...emptyCart,
          message: 'No cart found for user'
        });
      }

      const enrichedCart = await enrichCartWithProductDetails(cart);
      return res.json({
        ...enrichedCart,
        message: 'Cart retrieved successfully'
      });

    } catch (cartError) {
      console.error('Error getting or enriching cart:', cartError);
      // Return empty cart in case of any error
      return res.json({
        ...emptyCart,
        message: 'Error retrieving cart'
      });
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

    // Get product to verify it exists and get current price
    const product = await productService.getProduct(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // If user is not authenticated, return data to be stored in localStorage
    if (!userId) {
      return res.json({
        success: true,
        item: { 
          productId, 
          quantity, 
          size,
          price: product.price,
          name: product.name,
          image: product.images?.[0] // First image as preview
        },
        message: 'Item added to guest cart'
      });
    }

    // If there's a guest cart and user is logged in, merge it first
    if (guestCart && Array.isArray(guestCart.items) && guestCart.items.length > 0) {
      try {
        const cart = await cartService.convertGuestCartToStoredCart(userId, guestCart);
        const enrichedCart = await enrichCartWithProductDetails(cart);
        return res.json({
          ...enrichedCart,
          message: 'Guest cart merged and item added'
        });
      } catch (error) {
        console.error('Error converting guest cart:', error);
        // Continue with normal flow if conversion fails
      }
    }

    // Add item to user's cart
    const cart = await cartService.addToCart(
      userId,
      productId,
      product.price,
      quantity,
      size
    );

    const enrichedCart = await enrichCartWithProductDetails(cart);
    res.json({
      ...enrichedCart,
      message: 'Item added to cart successfully'
    });
  } catch (error) {
    console.error('Error in addToCart:', error);
    res.status(500).json({ 
      message: 'Error adding to cart',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
    const { shippingAddress, paymentMethod = 'paystack' } = req.body;

    // Validate shipping address
    if (!shippingAddress?.street || !shippingAddress.city || 
        !shippingAddress.state || !shippingAddress.country || !shippingAddress.postalCode) {
      return res.status(400).json({ message: 'Complete shipping address is required' });
    }

    // Get user's cart
    const cart = await cartService.getCart(userId);
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Perform bulk stock check
    const stockCheck = await cartService.bulkStockCheck(
      cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    );

    if (!stockCheck.valid) {
      return res.status(400).json({ 
        message: 'Stock validation failed', 
        issues: stockCheck.issues 
      });
    }

    // Calculate total
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = 0; // Free shipping for now
    const tax = 0; // No tax for now
    const total = subtotal + shippingCost + tax;

    // Create order data
    const orderData = {
      userId,
      items: cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        name: item.name || '',
        price: item.price,
        image: item.image || ''
      })),
      orderNumber: `ORD-${Date.now()}`,
      subtotal,
      tax,
      taxRate: 0,
      shippingCost,
      totalDiscount: 0,
      total,
      totalAmount: total,
      currency: 'USD',
      shippingAddress,
      status: 'pending' as const,
      paymentStatus: 'pending' as const,
      shipping: {
        name: req.user?.name || 'N/A',
        email: req.user?.email || 'N/A',
        phone: shippingAddress.phone || 'N/A',
        address: shippingAddress,
        method: 'standard' as const,
        cost: shippingCost
      },
      payment: {
        method: paymentMethod,
        status: 'pending' as const,
        amount: total,
        currency: 'USD'
      },
      user: {
        id: userId,
        email: req.user?.email || 'N/A',
        name: req.user?.name || 'N/A'
      }
    };

    // Create the order using order service
    const orderService = await import('../services/orderService');
    const order = await orderService.createOrder({
      ...orderData,
      priority: 'normal',
      source: 'web'
    }, userId);

    // Clear the cart after successful order creation
    await cartService.clearCart(userId);

    res.status(201).json({ 
      message: 'Order created successfully', 
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    if (error instanceof Error && error.message.includes('bulkStockCheck is not defined')) {
      res.status(500).json({ message: 'Stock validation failed: bulkStockCheck is not defined' });
    } else {
      res.status(500).json({ message: 'Error processing checkout', error: error instanceof Error ? error.message : 'Unknown error' });
    }
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
