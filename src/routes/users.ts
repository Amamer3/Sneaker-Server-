import { Router, Request, Response, NextFunction } from 'express';
import * as userController from '../controllers/userController';
import { authenticateJWT, authorizeRoles, AuthRequest } from '../middleware/auth';
import * as wishlistController from '../controllers/wishlistController';

const router = Router(); 

// Profile
router.get('/me', authenticateJWT, (req, res, next) => { void userController.getProfile(req, res, next); });
router.put('/me', authenticateJWT, (req, res, next) => { void userController.updateProfile(req, res, next); });

// Wishlist
router.get('/wishlist', authenticateJWT, (req: Request, res: Response) => { 
  void wishlistController.getUserWishlist(req as AuthRequest, res);
});
router.post('/wishlist', authenticateJWT, (req: Request, res: Response) => { 
  void wishlistController.addToWishlist(req as AuthRequest, res);
});
router.delete('/wishlist/:productId', authenticateJWT, (req: Request, res: Response) => { 
  void wishlistController.removeFromWishlist(req as AuthRequest, res);
});

// Address management
router.get('/me/addresses', authenticateJWT, (req, res, next) => { void userController.getAddresses(req, res, next); });
router.post('/me/addresses', authenticateJWT, (req, res, next) => { void userController.addAddress(req, res, next); });
router.put('/me/addresses/:addressId', authenticateJWT, (req, res, next) => { void userController.updateAddress(req, res, next); });
router.delete('/me/addresses/:addressId', authenticateJWT, (req, res, next) => { void userController.deleteAddress(req, res, next); });

// Admin
router.get('/', authenticateJWT, authorizeRoles('admin'), (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.getAllUsers(authReq, res, next);
});

router.delete('/:userId', authenticateJWT, authorizeRoles('admin'), (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.deleteUser(authReq, res, next);
});

// Add missing endpoints for user management
router.get('/:id', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.getUserById(authReq, res, next);
});

router.put('/:id', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  userController.updateUser(authReq, res, next);
});

export default router;
