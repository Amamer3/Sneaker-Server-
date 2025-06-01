import { Router, RequestHandler, Response } from 'express';
import * as wishlistController from '../controllers/wishlistController';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

const wrapHandler = (handler: (req: AuthRequest, res: Response) => Promise<any>): RequestHandler => 
  (req, res, next) => handler(req as AuthRequest, res).catch(next);

// Product Wishlist - All routes require authentication
router.use(authenticateJWT);

router.get('/', wrapHandler(wishlistController.getUserWishlist));
router.post('/', wrapHandler(wishlistController.addToWishlist)); // Changed to use body instead of params
router.delete('/:productId', wrapHandler(wishlistController.removeFromWishlist));
router.delete('/', wrapHandler(wishlistController.clearWishlist));

export default router;
