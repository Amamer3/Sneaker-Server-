import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

// Adjust `login` method to ensure compatibility with `RequestHandler`
export const login = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await authService.login(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Logged out' });
};

export const profile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const user = await authService.getProfile(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Add admin login method
export const adminLogin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new Error('All fields required');

    const user = await authService.login({ email, password });
    if (user.user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Not an admin' });
      return;
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Create admin user (only existing admins can do this)
export const createAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Only admins can create other admins' });
      return;
    }

    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      res.status(400).json({ message: 'Email, password and name are required' });
      return;
    }

    const user = await authService.register({
      email,
      password,
      name,
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
};
