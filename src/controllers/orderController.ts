import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../utils/helpers';
import { CreateOrderInput, OrderItem } from '../models/Order';
import { NotificationService } from '../services/notificationService';

export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);

    const { items, shippingAddress, total }: CreateOrderInput = req.body;

    // Validate items
    if (!items?.length) {
      throw new CustomError('Order must contain items', 400);
    }

    // Clean and validate items
    const cleanedItems = items.map(item => ({
      productId: item.productId,
      quantity: typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity,
      name: item.name || '',
      price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      image: item.image || ''
    }));

    // Validate shipping address
    if (!shippingAddress?.street || !shippingAddress.city || 
        !shippingAddress.state || !shippingAddress.country || !shippingAddress.postalCode) {
      throw new CustomError('Complete shipping address is required', 400);
    }    // Validate phone number
    if (!shippingAddress.phone) {
      throw new CustomError('Phone number is required', 400);
    }    // Clean shipping address and ensure all required fields
    const cleanedAddress = {
      street: shippingAddress.street.trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      country: shippingAddress.country.trim(),
      postalCode: shippingAddress.postalCode,
      zipCode: shippingAddress.zipCode,
      phone: shippingAddress.phone.trim()
    };

    // Get user details from request
    const userDetails = {
      id: userId,
      name: req.body.customerName || req.user?.name || 'N/A',
      email: req.body.email || req.user?.email || 'N/A',
      phone: shippingAddress.phone || 'N/A'
    };    // Create the shipping info
    const shippingInfo = {
      name: userDetails.name,
      email: userDetails.email,
      phone: userDetails.phone,
      address: cleanedAddress,
      method: 'standard' as const,
      cost: 0
    };

    // Calculate total
    const calculatedTotal = cleanedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (!calculatedTotal || calculatedTotal <= 0) {
      throw new CustomError('Valid total amount is required', 400);
    }    // Create the order with all required fields    // Create address string for the customer name if not provided
    const addressParts = [
      cleanedAddress.street,
      cleanedAddress.city,
      cleanedAddress.state,
      cleanedAddress.country
    ].filter(Boolean);
    const customerName = addressParts[0] || 'Unknown Customer';

    const order = await orderService.createOrder({
      userId,
      items: cleanedItems,
      orderNumber: `ORD-${Date.now()}`,
      subtotal: calculatedTotal,
      tax: 0,
      taxRate: 0,
      shippingCost: 0,
      totalDiscount: 0,
      total: total || calculatedTotal,
      totalAmount: total || calculatedTotal,
      currency: 'USD',
      shippingAddress: cleanedAddress,
      status: 'pending',
      paymentStatus: 'pending',
      shipping: shippingInfo,
      payment: {
        method: 'paystack',
        status: 'pending',
        amount: total || calculatedTotal,
        currency: 'USD'
      },
      user: {
        id: userId,
        email: userDetails.email,
        name: userDetails.name
      },
      priority: 'normal',
      source: 'web',
      paymentMethod: 'paystack'
    });

    if (!order) {
      throw new CustomError('Failed to create order', 500);
    }

    res.status(201).json(order);
  } catch (err) {
    console.error('Order creation error:', err);
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({ message: err.message });
    } else {
      res.status(500).json({ message: 'Failed to create order' });
    }
  }
};

export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) throw new CustomError('Order not found', 404);
    // Only allow owner or admin
    if (order.userId !== req.user?.id && req.user?.role !== 'admin') {
      throw new CustomError('Forbidden', 403);
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const { orders, total } = await orderService.getOrdersByUser(userId, page, limit, status);
    
    res.json({
      items: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    });
  } catch (err) {
    next(err);
  }
};

export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const { orders, total } = await orderService.getAllOrders(page, limit, status);
    
    res.json({
      items: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ message: 'Status is required' });
      return;
    }

    // Get the order first to access user information
    const order = await orderService.getOrderById(id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Update the order status
    await orderService.updateOrderStatus(id, status);

    // Send notification to the customer about status change
     const notificationService = new NotificationService();
    
    const statusMessages: { [key: string]: string } = {
      'pending': 'Your order is being processed',
      'confirmed': 'Your order has been confirmed',
      'processing': 'Your order is being prepared',
      'shipped': 'Your order has been shipped and is on its way',
      'delivered': 'Your order has been delivered successfully',
      'cancelled': 'Your order has been cancelled'
    };

    const message = statusMessages[status] || `Your order status has been updated to ${status}`;
    
    await notificationService.createNotification({
        userId: order.userId,
        type: 'order_update',
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `${message}. Order #${order.orderNumber}`,
        priority: status === 'delivered' || status === 'cancelled' ? 'high' : 'normal',
        channel: 'push',
        data: {
          orderId: id,
          orderNumber: order.orderNumber,
          newStatus: status
        }
      });

    res.json({ message: 'Order status updated and notification sent' });
  } catch (err) {
    if (err instanceof Error && err.message === 'Order not found') {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    next(err);
  }
};
