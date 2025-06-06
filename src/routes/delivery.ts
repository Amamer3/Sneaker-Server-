import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as deliveryController from '../controllers/deliveryController';

const router = Router();

// Public route - no authentication needed
router.get('/delivery-options', deliveryController.getDeliveryOptions);

// Protected route - requires authentication
router.post('/validate-delivery-address', authenticateJWT, deliveryController.validateDeliveryAddress);

export default router;
