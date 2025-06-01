import { Router } from 'express';
import * as wishlistController from '../controllers/wishlistController';

const router = Router();

// Product Wishlist
router.get('/', wishlistController.getUserWishlist);
router.post('/:productId', wishlistController.addToWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);

export default router;
