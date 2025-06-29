import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CouponService } from '../services/couponService';

const couponService = new CouponService();

export const getAllCoupons = async (req: AuthRequest, res: Response) => {
  try {
    const coupons = await couponService.getAllCoupons();
    res.json(coupons);
  } catch (error) {
    console.error('Error getting all coupons:', error);
    res.status(500).json({ 
      message: 'Failed to get coupons',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getCouponStats = async (req: AuthRequest, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const stats = await couponService.getCouponStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error getting coupon stats:', error);
    res.status(500).json({ 
      message: 'Failed to get coupon statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const createCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const couponData = req.body;
    const userId = req.user!.id;
    const newCoupon = await couponService.createCoupon(couponData, userId);
    res.status(201).json(newCoupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ 
      message: 'Failed to create coupon',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const couponData = req.body;
    const updatedCoupon = await couponService.updateCoupon(id, couponData);
    res.json(updatedCoupon);
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ 
      message: 'Failed to update coupon',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await couponService.deleteCoupon(id);
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ 
      message: 'Failed to delete coupon',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const validateCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { code, cartTotal } = req.body;
    const userId = req.user?.id;

    if (!code || typeof cartTotal !== 'number') {
      return res.status(400).json({ message: 'Coupon code and cart total are required' });
    }

    const validation = await couponService.validateCoupon(code, userId || '', null, cartTotal);
    res.json(validation);
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(400).json({ 
      message: 'Invalid coupon',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
