import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';

const router = Router();

// Product Reviews
router.get('/:id/reviews', reviewController.getProductReviews);
router.post('/:id/reviews', reviewController.addProductReview);
router.put('/:id/reviews/:reviewId', reviewController.updateProductReview);
router.delete('/:id/reviews/:reviewId', reviewController.deleteProductReview);

export default router;
