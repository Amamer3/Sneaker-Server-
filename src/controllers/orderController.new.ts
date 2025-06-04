import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../utils/helpers';

export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new CustomError('Unauthorized', 401);
    const orderId = await orderService.createOrder({ ...req.body, userId });
    res.status(201).json({ orderId });
  } catch (err) {
    next(err);
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
    await orderService.updateOrderStatus(req.params.id, req.body.status);
    res.json({ message: 'Order status updated' });
  } catch (err) {
    next(err);
  }
};
