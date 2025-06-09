import express, { Router, RequestHandler, json } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as paymentController from '../controllers/paymentController';

const router = express.Router();

// Configure route middleware based on path
router.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    // Use raw body for webhook to verify signature
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    // Use JSON parsing for all other routes
    json()(req, res, next);
  }
});

// Public routes
router.post('/webhook', paymentController.handleWebhook as RequestHandler);
router.get('/verify/:reference', paymentController.verifyPayment as RequestHandler);
router.post('/verify/:reference', paymentController.verifyPayment as RequestHandler);

// Protected routes
router.use(authenticateJWT);
router.post('/initialize', paymentController.initializePayment as RequestHandler);

// Error handling middleware
router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Payment route error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Payment processing error',
    code: err.code
  });
});

export default router;
