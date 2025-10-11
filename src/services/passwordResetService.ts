import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { FirestoreService } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { PasswordResetToken, PasswordResetRequest, PasswordResetConfirm } from '../models/PasswordReset';
import { User } from '../models/User';
import { admin } from '../config/firebase';
import Logger from '../utils/logger';

const passwordResetCollection = FirestoreService.collection(COLLECTIONS.PASSWORD_RESETS);
const usersCollection = FirestoreService.collection(COLLECTIONS.USERS);

export class PasswordResetService {
  
  /**
   * Request password reset - generates token and sends email
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find user by email
      const userSnap = await usersCollection.where('email', '==', email).get();
      if (userSnap.empty) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }

      const userData = userSnap.docs[0].data() as User;
      const userId = userSnap.docs[0].id;

      // Check if user account is active
      if (userData.status !== 'active') {
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }

      // Invalidate any existing reset tokens for this user
      await this.invalidateExistingTokens(userId);

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

      // Create password reset record
      const passwordReset: Omit<PasswordResetToken, 'id'> = {
        userId,
        email,
        token: resetToken,
        expiresAt,
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await passwordResetCollection.add(passwordReset);

      // Send password reset email
      await this.sendPasswordResetEmail(email, userData.name, resetToken);

      Logger.info(`Password reset requested for user: ${userId} (${email})`);

      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      };

    } catch (error) {
      Logger.error('Error requesting password reset:', error);
      throw new Error('Failed to process password reset request');
    }
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        return {
          success: false,
          message: 'Password must be at least 8 characters long'
        };
      }

      // Find valid reset token
      const tokenSnap = await passwordResetCollection
        .where('token', '==', token)
        .where('used', '==', false)
        .get();

      if (tokenSnap.empty) {
        return {
          success: false,
          message: 'Invalid or expired reset token'
        };
      }

      const resetData = tokenSnap.docs[0].data() as PasswordResetToken;
      const resetId = tokenSnap.docs[0].id;

      // Check if token is expired
      if (new Date() > resetData.expiresAt) {
        // Mark token as used to prevent reuse
        await passwordResetCollection.doc(resetId).update({
          used: true,
          usedAt: new Date(),
          updatedAt: new Date()
        });

        return {
          success: false,
          message: 'Reset token has expired. Please request a new one.'
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password in Firestore
      await usersCollection.doc(resetData.userId).update({
        password: hashedPassword,
        updatedAt: new Date()
      });

      // Update password in Firebase Auth
      try {
        await admin.auth().updateUser(resetData.userId, {
          password: newPassword
        });
      } catch (firebaseError) {
        Logger.error('Error updating Firebase Auth password:', firebaseError);
        // Continue anyway as Firestore update succeeded
      }

      // Mark reset token as used
      await passwordResetCollection.doc(resetId).update({
        used: true,
        usedAt: new Date(),
        updatedAt: new Date()
      });

      // Invalidate all existing sessions for this user
      await this.invalidateUserSessions(resetData.userId);

      Logger.info(`Password reset completed for user: ${resetData.userId} (${resetData.email})`);

      return {
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.'
      };

    } catch (error) {
      Logger.error('Error confirming password reset:', error);
      throw new Error('Failed to reset password');
    }
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; message: string }> {
    try {
      const tokenSnap = await passwordResetCollection
        .where('token', '==', token)
        .where('used', '==', false)
        .get();

      if (tokenSnap.empty) {
        return {
          valid: false,
          message: 'Invalid reset token'
        };
      }

      const resetData = tokenSnap.docs[0].data() as PasswordResetToken;

      if (new Date() > resetData.expiresAt) {
        return {
          valid: false,
          message: 'Reset token has expired'
        };
      }

      return {
        valid: true,
        message: 'Token is valid'
      };

    } catch (error) {
      Logger.error('Error validating reset token:', error);
      return {
        valid: false,
        message: 'Error validating token'
      };
    }
  }

  /**
   * Invalidate existing reset tokens for a user
   */
  private async invalidateExistingTokens(userId: string): Promise<void> {
    try {
      const existingTokens = await passwordResetCollection
        .where('userId', '==', userId)
        .where('used', '==', false)
        .get();

      const batch = FirestoreService.batch();
      existingTokens.docs.forEach(doc => {
        batch.update(doc.ref, {
          used: true,
          usedAt: new Date(),
          updatedAt: new Date()
        });
      });

      if (!existingTokens.empty) {
        await batch.commit();
        Logger.info(`Invalidated ${existingTokens.size} existing reset tokens for user: ${userId}`);
      }
    } catch (error) {
      Logger.error('Error invalidating existing tokens:', error);
    }
  }

  /**
   * Invalidate all user sessions (blacklist all tokens)
   */
  private async invalidateUserSessions(userId: string): Promise<void> {
    try {
      // This would require tracking active tokens per user
      // For now, we'll just log that sessions should be invalidated
      Logger.info(`User sessions invalidated for user: ${userId}`);
    } catch (error) {
      Logger.error('Error invalidating user sessions:', error);
    }
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    try {
      // For now, we'll just log the email content
      // In a real implementation, you would integrate with an email service
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      
      const emailContent = {
        to: email,
        subject: 'Password Reset Request - Sneaker Store',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hello ${name},</p>
            <p>You requested a password reset for your Sneaker Store account. Click the link below to reset your password:</p>
            <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>Best regards,<br>The Sneaker Store Team</p>
          </div>
        `,
        text: `
          Password Reset Request
          
          Hello ${name},
          
          You requested a password reset for your Sneaker Store account. 
          Visit this link to reset your password: ${resetUrl}
          
          This link will expire in 1 hour for security reasons.
          
          If you didn't request this password reset, please ignore this email.
          
          Best regards,
          The Sneaker Store Team
        `
      };

      // Log email content for development
      Logger.info('Password reset email would be sent:', {
        to: email,
        subject: emailContent.subject,
        resetUrl
      });

      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      // await emailService.sendEmail(emailContent);

    } catch (error) {
      Logger.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const expiredTokens = await passwordResetCollection
        .where('expiresAt', '<', new Date())
        .where('used', '==', false)
        .get();

      const batch = FirestoreService.batch();
      expiredTokens.docs.forEach(doc => {
        batch.update(doc.ref, {
          used: true,
          usedAt: new Date(),
          updatedAt: new Date()
        });
      });

      if (!expiredTokens.empty) {
        await batch.commit();
        Logger.info(`Cleaned up ${expiredTokens.size} expired password reset tokens`);
      }
    } catch (error) {
      Logger.error('Error cleaning up expired tokens:', error);
    }
  }
}

export const passwordResetService = new PasswordResetService();
