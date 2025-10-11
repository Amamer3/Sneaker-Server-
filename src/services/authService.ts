import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { admin } from '../config/firebase';
import { User, UserProfile, UserPreferences, UserAnalytics } from '../models/User';
import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { NotificationService } from './notificationService';

const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);

export async function register(data: {
  email: string;
  password: string;
  name: string;
  role?: 'customer' | 'admin';
  phone?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
}): Promise<{ token: string; user: User }> {
  const { email, password, name, role = 'customer', phone, dateOfBirth, gender } = data;
  
  // Validation
  if (!email || !password || !name) {
    throw new Error('Email, password, and name are required');
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  // Check if user already exists
  const userSnap = await usersCollection.where('email', '==', email).get();
  if (!userSnap.empty) {
    const { CustomError } = await import('../utils/helpers');
    throw new CustomError('Email address is already in use', 409);
  }

  try {
    // Create user in Firebase Authentication
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false
    });

    const hash = await bcrypt.hash(password, 12);
    const now = admin.firestore.Timestamp.now();
    
    // Initialize user profile
    const profile: UserProfile = {
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || '',
      phone: phone || '',
      dateOfBirth: dateOfBirth,
      gender: gender || 'other',
      avatar: '',
      bio: ''
    };

    // Initialize user preferences
    const preferences: UserPreferences = {
      newsletter: true,
      smsNotifications: false,
      emailNotifications: true,
      language: 'en',
      currency: 'USD',
      theme: 'light',
      sizePreference: '',
      brandPreferences: [],
      categoryPreferences: []
    };

    // Initialize user analytics
    const analytics: UserAnalytics = {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      lastOrderDate: undefined,
      favoriteCategories: [],
      favoriteBrands: [],
      loginCount: 0,
      lastLoginAt: undefined,
      accountAge: 0,
      lifetimeValue: 0
    };

    const user: User = {
      id: firebaseUser.uid,
      email,
      password: hash,
      name,
      role,
      profile,
      addresses: [],
      preferences,
      analytics,
      isEmailVerified: false,
      isPhoneVerified: false,
      status: 'active',
      lastLoginAt: undefined,
      createdAt: now.toDate(),
      updatedAt: now.toDate()
    };

    // Store user in Firestore
    await usersCollection.doc(firebaseUser.uid).set(user);

    // Send welcome notification
    try {
      const notificationService = new NotificationService();
      await notificationService.sendWelcomeNotification(user);
    } catch (error) {
      console.error('Failed to send welcome notification:', error);
    }

    // Generate verification token and send email
    try {
      await sendEmailVerification(firebaseUser.uid);
    } catch (error) {
      console.error('Failed to send email verification:', error);
    }

    const token = jwt.sign(
      { id: firebaseUser.uid, role, email, name }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '7d' }
    );
    
    // Remove password from response
    const { password: _, ...userResponse } = user;
    
    return { token, user: userResponse };
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle specific Firebase auth errors
    if (error.code === 'auth/email-already-exists') {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Email address is already in use', 409);
    }
    
    if (error.code === 'auth/invalid-email') {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Invalid email address', 400);
    }
    
    if (error.code === 'auth/weak-password') {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Password is too weak', 400);
    }
    
    // For other errors, throw a generic server error
    const { CustomError } = await import('../utils/helpers');
    throw new CustomError('Failed to create user account', 500);
  }
}

export async function login(email: string, password: string, deviceInfo?: {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
}): Promise<{ token: string; user: User; refreshToken: string }> {
  if (!email || !password) {
    const { CustomError } = await import('../utils/helpers');
    throw new CustomError('Email and password are required', 400);
  }

  try {
    const userSnap = await usersCollection.where('email', '==', email).get();
    if (userSnap.empty) {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Invalid credentials', 401);
    }

    const userData = userSnap.docs[0].data() as User;
    
    // Check account status
    if (userData.status === 'suspended') {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Account has been suspended. Please contact support.', 403);
    }
    
    if (userData.status === 'inactive') {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Account is inactive. Please contact support.', 403);
    }

    if (!userData.password) {
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Invalid credentials', 401);
    }
    const isValid = await bcrypt.compare(password, userData.password);
    if (!isValid) {
      // Log failed login attempt
      await logFailedLoginAttempt(userData.id, deviceInfo);
      const { CustomError } = await import('../utils/helpers');
      throw new CustomError('Invalid credentials', 401);
    }

    // Update login analytics
    const now = admin.firestore.Timestamp.now();
    const updates: any = {
      lastLoginAt: now.toDate(),
      updatedAt: now.toDate()
    };

    await usersCollection.doc(userData.id).update(updates);

    // Generate tokens - only include essential data
    const token = jwt.sign(
      { id: userData.id, role: userData.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
 
    const refreshToken = jwt.sign(
      { id: userData.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    // Log successful login
    await logLoginActivity(userData.id, 'login', deviceInfo);

    // Remove password from response
    const { password: _, ...userResponse } = {
      ...userData,
      lastLoginAt: now.toDate()
    };

    return { token, user: userResponse, refreshToken };
  } catch (error: any) {
    console.error('Login error:', error);
    if (error.statusCode) {
      // Re-throw CustomError instances
      throw error;
    }
    const { CustomError } = await import('../utils/helpers');
    throw new CustomError('Login failed', 500);
  }
}

export async function getProfile(userId: string): Promise<User | null> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) return null;
    
    const userData = userDoc.data() as User;
    
    // Remove password from response
    const { password: _, ...userProfile } = userData;
    
    return userProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Password Reset Functions
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  try {
    const userSnap = await usersCollection.where('email', '==', email).get();
    if (userSnap.empty) {
      // Don't reveal if email exists for security
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    const userData = userSnap.docs[0].data() as User;
    
    // Generate reset token
    const resetToken = jwt.sign(
      { id: userData.id, email: userData.email, type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Update user timestamp
    await usersCollection.doc(userData.id).update({
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });

    // Send password reset notification
    try {
      const notificationService = new NotificationService();
      await notificationService.sendPasswordResetNotification(userData, resetToken);
    } catch (error) {
      console.error('Failed to send password reset notification:', error);
    }

    return { message: 'If the email exists, a password reset link has been sent.' };
  } catch (error) {
    console.error('Password reset request error:', error);
    throw new Error('Failed to process password reset request');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  try {
    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid reset token');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const userDoc = await usersCollection.doc(decoded.id).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await usersCollection.doc(decoded.id).update({
      password: hashedPassword,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });

    // Update Firebase Auth password with hashed version
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await admin.auth().updateUser(decoded.id, {
        password: hashedPassword
      });
    } catch (error) {
      console.error('Failed to update Firebase Auth password:', error);
    }

    // Log password change
    await logLoginActivity(decoded.id, 'password_reset');

    return { message: 'Password has been reset successfully' };
  } catch (error) {
    console.error('Password reset error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reset password');
  }
}

// Email Verification Functions
export async function sendEmailVerification(userId: string): Promise<{ message: string }> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    
    if (userData.isEmailVerified) {
      return { message: 'Email is already verified' };
    }

    // Generate verification token
    const verificationToken = jwt.sign(
      { id: userData.id, email: userData.email, type: 'email_verification' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Update user timestamp
    await usersCollection.doc(userId).update({
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });

    // Send verification notification
    try {
      const notificationService = new NotificationService();
      await notificationService.sendEmailVerificationNotification(userData, verificationToken);
    } catch (error) {
      console.error('Failed to send verification notification:', error);
    }

    return { message: 'Verification email sent successfully' };
  } catch (error) {
    console.error('Email verification send error:', error);
    throw new Error('Failed to send verification email');
  }
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.type !== 'email_verification') {
      throw new Error('Invalid verification token');
    }

    const userDoc = await usersCollection.doc(decoded.id).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    
    if (userData.isEmailVerified) {
      return { message: 'Email is already verified' };
    }

    // Update user as verified
    await usersCollection.doc(decoded.id).update({
      isEmailVerified: true,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });

    // Update Firebase Auth
    try {
      await admin.auth().updateUser(decoded.id, {
        emailVerified: true
      });
    } catch (error) {
      console.error('Failed to update Firebase Auth email verification:', error);
    }

    return { message: 'Email verified successfully' };
  } catch (error) {
    console.error('Email verification error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to verify email');
  }
}

// Token Management
export async function refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  try {
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!
    ) as any;
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    const userDoc = await usersCollection.doc(decoded.id).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    
    if (userData.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Generate new tokens
    const newToken = jwt.sign(
      { id: userData.id, role: userData.role, email: userData.email, name: userData.name },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    const newRefreshToken = jwt.sign(
      { id: userData.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return { token: newToken, refreshToken: newRefreshToken };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh token');
  }
}

// User Profile Management
export async function updateProfile(userId: string, updates: {
  name?: string;
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
}): Promise<User> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    const updateData: any = {
      updatedAt: admin.firestore.Timestamp.now().toDate()
    };

    if (updates.name) {
      updateData.name = updates.name;
      // Update Firebase Auth display name
      try {
        await admin.auth().updateUser(userId, {
          displayName: updates.name
        });
      } catch (error) {
        console.error('Failed to update Firebase Auth display name:', error);
      }
    }

    if (updates.profile) {
      Object.keys(updates.profile).forEach(key => {
        updateData[`profile.${key}`] = updates.profile![key as keyof UserProfile];
      });
    }

    if (updates.preferences) {
      Object.keys(updates.preferences).forEach(key => {
        updateData[`preferences.${key}`] = updates.preferences![key as keyof UserPreferences];
      });
    }

    await usersCollection.doc(userId).update(updateData);

    // Get updated user data
    const updatedDoc = await usersCollection.doc(userId).get();
    const updatedUser = updatedDoc.data() as User;
    
    // Remove password from response
    const { password: _, ...userResponse } = updatedUser;
    
    return userResponse;
  } catch (error) {
    console.error('Profile update error:', error);
    throw new Error('Failed to update profile');
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    
    // Verify current password
    if (!userData.password) {
      throw new Error('Current password is incorrect');
    }
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await usersCollection.doc(userId).update({
      password: hashedPassword,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });

    // Update Firebase Auth password with hashed version
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await admin.auth().updateUser(userId, {
        password: hashedPassword
      });
    } catch (error) {
      console.error('Failed to update Firebase Auth password:', error);
    }

    // Log password change
    await logLoginActivity(userId, 'password_change');

    return { message: 'Password changed successfully' };
  } catch (error) {
    console.error('Password change error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to change password');
  }
}

export async function validatePassword(userId: string, currentPassword: string): Promise<{ valid: boolean; message: string }> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    
    // Verify current password
    if (!userData.password) {
      return { valid: false, message: 'Password validation failed' };
    }
    
    const isPasswordValid = await bcrypt.compare(currentPassword, userData.password);
    
    if (isPasswordValid) {
      return { valid: true, message: 'Password is valid' };
    } else {
      return { valid: false, message: 'Invalid password' };
    }
  } catch (error) {
    console.error('Password validation error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to validate password');
  }
}

// User Management (Admin functions)
export async function getAllUsers(options: {
  page?: number;
  limit?: number;
  role?: 'customer' | 'admin';
  status?: 'active' | 'suspended' | 'deleted';
  search?: string;
} = {}): Promise<{ users: User[]; total: number; page: number; totalPages: number }> {
  try {
    const { page = 1, limit = 20, role, status, search } = options;
    const offset = (page - 1) * limit;

    let query = usersCollection.orderBy('createdAt', 'desc');

    if (role) {
      query = query.where('role', '==', role) as any;
    }

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    // Get total count
    const totalSnap = await query.get();
    let users = totalSnap.docs.map(doc => {
      const userData = doc.data() as User;
      const { password: _, ...userWithoutPassword } = userData;
      return userWithoutPassword;
    });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }

    const total = users.length;
    const totalPages = Math.ceil(total / limit);
    
    // Apply pagination
    const paginatedUsers = users.slice(offset, offset + limit);

    return {
      users: paginatedUsers,
      total,
      page,
      totalPages
    };
  } catch (error) {
    console.error('Get all users error:', error);
    throw new Error('Failed to fetch users');
  }
}

export async function updateUserStatus(userId: string, status: 'active' | 'suspended' | 'deleted', adminId: string): Promise<{ message: string }> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    await usersCollection.doc(userId).update({
      status: status,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });

    // Update Firebase Auth
    try {
      await admin.auth().updateUser(userId, {
        disabled: status === 'suspended' || status === 'deleted'
      });
    } catch (error) {
      console.error('Failed to update Firebase Auth status:', error);
    }

    // Log status change
    await logLoginActivity(userId, `status_changed_to_${status}`, { adminId });

    return { message: `User status updated to ${status}` };
  } catch (error) {
    console.error('Update user status error:', error);
    throw new Error('Failed to update user status');
  }
}

// Analytics and Reporting
export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as User;
    return userData.analytics || {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      lastOrderDate: undefined,
      favoriteCategories: [],
      favoriteBrands: [],
      loginCount: 0,
      lastLoginAt: undefined,
      accountAge: 0,
      lifetimeValue: 0
    };
  } catch (error) {
    console.error('Get user analytics error:', error);
    throw new Error('Failed to fetch user analytics');
  }
}

export async function updateUserAnalytics(userId: string, analytics: Partial<UserAnalytics>): Promise<void> {
  try {
    const updateData: any = {
      updatedAt: admin.firestore.Timestamp.now().toDate()
    };

    Object.keys(analytics).forEach(key => {
      updateData[`analytics.${key}`] = analytics[key as keyof UserAnalytics];
    });

    await usersCollection.doc(userId).update(updateData);
  } catch (error) {
    console.error('Update user analytics error:', error);
    throw new Error('Failed to update user analytics');
  }
}

// Logout and Session Management
export async function logout(userId: string, deviceInfo?: any): Promise<{ message: string }> {
  try {
    // Log logout activity
    await logLoginActivity(userId, 'logout', deviceInfo);
    
    return { message: 'Logged out successfully' };
  } catch (error) {
    console.error('Logout error:', error);
    return { message: 'Logged out successfully' }; // Always return success for logout
  }
}

// Helper Functions
async function logLoginActivity(userId: string, activity: string, deviceInfo?: any): Promise<void> {
  try {
    const loginLog = {
      userId,
      activity,
      timestamp: admin.firestore.Timestamp.now(),
      deviceInfo: deviceInfo || {},
      ipAddress: deviceInfo?.ipAddress || 'unknown',
      userAgent: deviceInfo?.userAgent || 'unknown'
    };

    await FirestoreService.collection('login_logs').add(loginLog);
  } catch (error) {
    console.error('Failed to log login activity:', error);
  }
}

async function logFailedLoginAttempt(userId: string, deviceInfo?: any): Promise<void> {
  try {
    const failedAttempt = {
      userId,
      timestamp: admin.firestore.Timestamp.now(),
      deviceInfo: deviceInfo || {},
      ipAddress: deviceInfo?.ipAddress || 'unknown',
      userAgent: deviceInfo?.userAgent || 'unknown'
    };

    await FirestoreService.collection('failed_login_attempts').add(failedAttempt);
  } catch (error) {
    console.error('Failed to log failed login attempt:', error);
  }
}

// Utility Functions
export async function verifyToken(token: string): Promise<{ id: string; role: string; email: string } | null> {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Check if user still exists and is active
    const userDoc = await usersCollection.doc(decoded.id).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as User;
    if (userData.status !== 'active') {
      return null;
    }

    return {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };
  } catch (error) {
    return null;
  }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const userSnap = await usersCollection.where('email', '==', email).get();
    return !userSnap.empty;
  } catch (error) {
    console.error('Check email exists error:', error);
    return false;
  }
}
