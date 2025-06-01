import { Router } from 'express';
import * as cartController from '../controllers/cartController';

const router = Router();

// Product Cart
router.get('/', cartController.getUserCart);
router.post('/', cartController.addToCart);
router.put('/:itemId', cartController.updateCartItem);
router.delete('/:itemId', cartController.removeFromCart);
router.post('/checkout', cartController.processCheckout);

export default router;
