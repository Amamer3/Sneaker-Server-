import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';
import { admin } from '../config/firebase';
import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';

const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);

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
    const { email, password } = req.body;
    const deviceInfo = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop'
    };
    const data = await authService.login(email, password, deviceInfo);
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
    if (!email || !password) {
      res.status(400).json({ message: 'All fields required' });
      return;
    }

    try {
      // First verify if the user exists and is an admin
      const userRecord = await admin.auth().getUserByEmail(email);
      const userDoc = await usersCollection.doc(userRecord.uid).get();
      const userData = userDoc.data();
      
      if (!userDoc.exists || userData?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Not an admin' });
        return;
      }

      // If the user is an admin, attempt to log them in
      const loginResult = await authService.login(email, password);
      res.json(loginResult);
    } catch (innerError) {
      // Don't expose whether the user exists or not
      console.error('Admin login error:', innerError);
      res.status(403).json({ message: 'Invalid credentials or not an admin' });
    }
  } catch (err) {
    console.error('Unexpected error during admin login:', err);
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

    const result = await authService.register({
      email,
      password,
      name,
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role
      }
    });
  } catch (err) {
    next(err);
  }
};
