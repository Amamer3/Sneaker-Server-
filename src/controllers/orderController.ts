import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../utils/helpers';
import { CreateOrderInput, OrderItem } from '../models/Order';

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
    }

    // Clean shipping address
    const cleanedAddress = {
      street: shippingAddress.street.trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      country: shippingAddress.country.trim(),
      postalCode: shippingAddress.postalCode,
      zipCode: shippingAddress.zipCode
    };

    // Calculate total
    const calculatedTotal = cleanedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (!calculatedTotal || calculatedTotal <= 0) {
      throw new CustomError('Valid total amount is required', 400);
    }    // Create the order with all required fields
    const order = await orderService.createOrder({
      userId,
      items: cleanedItems,
      total: total || calculatedTotal,
      totalAmount: total || calculatedTotal, // Add totalAmount to match interface
      shippingAddress: cleanedAddress,
      status: 'pending',
      shipping: {
        name: cleanedAddress.street,
        email: '',
        phone: '',
        address: cleanedAddress
      },
      user: {
        id: userId,
        email: '',
        name: ''
      },
      paymentMethod: 'paystack' // Add default payment method
    });if (!order) {
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

    await orderService.updateOrderStatus(id, status);
    res.json({ message: 'Order status updated' });
  } catch (err) {
    if (err instanceof Error && err.message === 'Order not found') {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    next(err);
  }
};
