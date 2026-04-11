import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';
import { admin } from '../config/firebase';
import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { isEmailSendingConfigured, sendFirebasePasswordResetEmail } from '../services/emailService';

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

export const logout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { TokenBlacklistService } = await import('../services/tokenBlacklistService');
      await TokenBlacklistService.blacklistToken(token);
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
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

// Change admin password
export const changeAdminPassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Admin access required' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current password and new password are required' });
      return;
    }

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Validate admin password
export const validateAdminPassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Admin access required' });
      return;
    }

    const { currentPassword } = req.body;
    
    if (!currentPassword) {
      res.status(400).json({ message: 'Current password is required' });
      return;
    }

    const result = await authService.validatePassword(req.user.id, currentPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Refresh token
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const PASSWORD_RESET_GENERIC_MESSAGE =
  'If an account exists for this email, you will receive reset instructions shortly.';

// Firebase password reset request (uniform response to reduce account enumeration)
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.body.email ?? '').trim();

    const userSnap = await usersCollection.where('email', '==', email).get();
    if (userSnap.empty) {
      res.json({ success: true, message: PASSWORD_RESET_GENERIC_MESSAGE });
      return;
    }

    const userData = userSnap.docs[0].data();
    if (userData.status !== 'active') {
      res.json({ success: true, message: PASSWORD_RESET_GENERIC_MESSAGE });
      return;
    }

    try {
      const resetLink = await admin.auth().generatePasswordResetLink(email, {
        url: `${process.env.FRONTEND_URL || 'http://127.0.0.1:5173'}/reset-password`,
        handleCodeInApp: false,
      });

      if (isEmailSendingConfigured()) {
        try {
          await sendFirebasePasswordResetEmail(email, resetLink);
        } catch (sendErr) {
          console.error('Resend password reset failed:', sendErr);
          res.status(503).json({
            success: false,
            message: 'Could not send the reset email. Please try again later.',
          });
          return;
        }
      } else if (process.env.NODE_ENV === 'production') {
        res.status(503).json({
          success: false,
          message: 'Password reset email is not available. Please contact support.',
        });
        return;
      }

      res.json({
        success: true,
        message: PASSWORD_RESET_GENERIC_MESSAGE,
        ...(process.env.NODE_ENV === 'development' && { resetLink }),
      });
    } catch (firebaseError: unknown) {
      console.error('Firebase password reset error:', firebaseError);
      // Do not distinguish auth/user-not-found from other failures (enumeration / drift)
      res.json({ success: true, message: PASSWORD_RESET_GENERIC_MESSAGE });
    }
  } catch (err) {
    next(err);
  }
};

export const resetPasswordWithToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const verifyEmailWithToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body as { token: string };
    const result = await authService.verifyEmail(token);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};