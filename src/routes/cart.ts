import { Router, RequestHandler, Response } from 'express';
import * as cartController from '../controllers/cartController';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Type assertion for route handlers to work with AuthRequest
const wrapHandler = (handler: (req: AuthRequest, res: Response) => Promise<any>): RequestHandler => 
  (req, res, next) => handler(req as AuthRequest, res).catch(next);

// Optional authentication middleware - doesn't fail if no token provided
const optionalAuth = (req: AuthRequest, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = decoded as { id: string; role: string; name?: string; email?: string };
    } catch (error) {
      // Invalid token, but continue without user
      console.warn('Invalid token provided:', error);
    }
  }
  next();
};

/**
 * @swagger
 * /cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     description: Add a product to the shopping cart. Works for both guest and authenticated users.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to add
 *               quantity:
 *                 type: number
 *                 description: Quantity of the product
 *                 minimum: 1
 *               size:
 *                 type: string
 *                 description: Size of the product (if applicable)
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', optionalAuth, wrapHandler(cartController.addToCart));

/**
 * @swagger
 * /cart/{itemId}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       404:
 *         description: Item not found in cart
 */
router.put('/:itemId', optionalAuth, wrapHandler(cartController.updateCartItem));

/**
 * @swagger
 * /cart/{itemId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removed from cart
 *       404:
 *         description: Item not found in cart
 */
router.delete('/:itemId', optionalAuth, wrapHandler(cartController.removeFromCart));

/**
 * @swagger
 * /cart:
 *   delete:
 *     summary: Clear cart
 *     tags: [Cart]
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 */
router.delete('/', optionalAuth, wrapHandler(cartController.clearCart));

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get cart contents
 *     tags: [Cart]
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 */
router.get('/', optionalAuth, wrapHandler(cartController.getUserCart));

// Protected cart routes (require authentication)
router.post('/sync', authenticateJWT, wrapHandler(cartController.syncCart));
router.post('/checkout', authenticateJWT, wrapHandler(cartController.processCheckout));

// Apply coupon to cart
router.post('/apply-coupon', authenticateJWT, wrapHandler(cartController.applyCoupon));

// Remove coupon from cart
router.post('/remove-coupon', authenticateJWT, wrapHandler(cartController.removeCoupon));

export default router;
