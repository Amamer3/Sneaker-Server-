import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import Logger from '../utils/logger';

/**
 * Middleware to check if the authenticated user has admin privileges
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    if (!user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    Logger.error('Error in admin middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};