import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as deliveryController from '../controllers/deliveryController';

const router = Router();

// Apply authentication to all delivery routes
router.use(authenticateJWT);

// Get delivery options
router.get('/delivery-options', deliveryController.getDeliveryOptions);

// Validate delivery address
router.post('/validate-delivery-address', deliveryController.validateDeliveryAddress);

export default router;
