import { Router, Request, Response, NextFunction } from 'express';
import * as authController from '../controllers/authController';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordWithTokenValidation,
  verifyEmailTokenValidation,
  validate,
} from '../middleware/validation';
import {
  forgotPasswordEmailRateLimit,
  forgotPasswordIpRateLimit,
  resetPasswordWithTokenIpRateLimit,
} from '../middleware/passwordResetRateLimit';

const router = Router();
 
// Register route
router.post('/register', registerValidation, validate, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  authController.register(authReq, res, next);
});

// Login route
router.post('/login', loginValidation, validate, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  authController.login(authReq, res, next);
});

// Add admin login endpoint
router.post('/admin/login', loginValidation, validate, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  authController.adminLogin(authReq, res, next);
});

// Logout route
router.post('/logout', authController.logout);

// Profile route
router.get('/profile', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  void authController.profile(authReq, res, next);
});

// Register new admin (requires admin authentication)
router.post('/admin/register', 
  authenticateJWT, 
  registerValidation, 
  validate, 
  (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    authController.createAdmin(authReq, res, next);
  }
);

// Admin password management endpoints
router.post('/admin/change-password', 
  authenticateJWT, 
  (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    authController.changeAdminPassword(authReq, res, next);
  }
);

router.post('/admin/validate-password', 
  authenticateJWT, 
  (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    authController.validateAdminPassword(authReq, res, next);
  }
);

// Refresh token route
router.post('/refresh-token', (req: Request, res: Response, next: NextFunction) => {
  authController.refreshToken(req, res, next);
});

// Password reset: request link (Firebase email link flow)
router.post(
  '/forgot-password',
  forgotPasswordIpRateLimit,
  forgotPasswordValidation,
  validate,
  forgotPasswordEmailRateLimit,
  (req: Request, res: Response, next: NextFunction) => {
    authController.forgotPassword(req, res, next);
  }
);

// Password reset: submit new password (JWT from custom email link)
router.post(
  '/reset-password',
  resetPasswordWithTokenIpRateLimit,
  resetPasswordWithTokenValidation,
  validate,
  (req: Request, res: Response, next: NextFunction) => {
    authController.resetPasswordWithToken(req, res, next);
  }
);

// Email verification (JWT from Resend link → frontend loads ?token= then POSTs here)
router.post(
  '/verify-email',
  verifyEmailTokenValidation,
  validate,
  (req: Request, res: Response, next: NextFunction) => {
    authController.verifyEmailWithToken(req, res, next);
  }
);

export default router;
