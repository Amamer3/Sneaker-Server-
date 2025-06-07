import express, { Router, RequestHandler } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as paymentController from '../controllers/paymentController';

const router = express.Router();

// Public webhook endpoint - needs raw body for signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// Protected payment routes
router.use(authenticateJWT);

// Initialize payment with Paystack
router.post('/initialize', paymentController.initializePayment as RequestHandler);

// Verify payment
router.get('/verify/:reference', paymentController.verifyPayment as RequestHandler);

export default router;
