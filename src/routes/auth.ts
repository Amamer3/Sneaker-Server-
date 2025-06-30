import { Router, Request, Response, NextFunction } from 'express';
import * as authController from '../controllers/authController';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { registerValidation, loginValidation, validate } from '../middleware/validation';

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

export default router;
