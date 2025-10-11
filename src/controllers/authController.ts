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

// Firebase Password Reset Request
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
      return;
    }

    // Check if user exists in Firestore first
    const userSnap = await usersCollection.where('email', '==', email).get();
    if (userSnap.empty) {
      // Email doesn't exist in our system
      res.status(404).json({
        success: false,
        message: 'No account found with that email address.'
      });
      return;
    }

    const userData = userSnap.docs[0].data();
    const userId = userSnap.docs[0].id;

    // Check if user account is active
    if (userData.status !== 'active') {
      res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
      return;
    }

    try {
      // Generate password reset link using Firebase Admin SDK
      const resetLink = await admin.auth().generatePasswordResetLink(email, {
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`,
        handleCodeInApp: false
      });

      console.log(`Password reset link generated for ${email}: ${resetLink}`);

      // TODO: Send email using your email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the link for development
      console.log(`📧 Password reset email should be sent to: ${email}`);
      console.log(`🔗 Reset link: ${resetLink}`);

      res.json({
        success: true,
        message: 'Password reset link has been sent to your email address.',
        // In development, include the reset link for testing
        ...(process.env.NODE_ENV === 'development' && { resetLink })
      });

    } catch (firebaseError: any) {
      console.error('Firebase password reset error:', firebaseError);
      
      // Handle specific Firebase errors
      if (firebaseError.code === 'auth/user-not-found') {
        res.status(404).json({
          success: false,
          message: 'No account found with that email address.'
        });
        return;
      }

      throw new Error('Failed to generate password reset link');
    }

  } catch (err) {
    next(err);
  }
};