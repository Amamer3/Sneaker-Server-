import { Router, RequestHandler, Response } from 'express';
import * as cartController from '../controllers/cartController';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Type assertion for route handlers to work with AuthRequest
const wrapHandler = (handler: (req: AuthRequest, res: Response) => Promise<any>): RequestHandler => 
  (req, res, next) => handler(req as AuthRequest, res).catch(next);

// All cart routes require authentication
router.use(authenticateJWT);

// Cart routes
router.get('/', wrapHandler(cartController.getUserCart));
router.post('/', wrapHandler(cartController.addToCart));
router.put('/:itemId', wrapHandler(cartController.updateCartItem));
router.delete('/:itemId', wrapHandler(cartController.removeFromCart));
router.delete('/', wrapHandler(cartController.clearCart));
router.post('/checkout', wrapHandler(cartController.processCheckout));

export default router;
