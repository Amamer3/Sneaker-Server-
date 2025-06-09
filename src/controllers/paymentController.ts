import { Request, Response } from 'express';
import { paymentService } from '../services/paymentService';
import Logger from '../utils/logger';
import { Order } from '../models/Order';

export const initializePayment = async (req: Request, res: Response) => {
  try {
    Logger.debug('Payment initialization request:', { body: req.body, user: (req as any).user });
    
    const { amount, orderId } = req.body;
    const customerId = (req as any).user?.id;
    const email = req.body.email || (req as any).user?.email; // Try body first, then user

    if (!amount || !orderId || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Amount, orderId, and email are required'
      });
    }

        // Validate the amount is a valid number
    if (isNaN(amount) || amount <= 0) {
      Logger.error('Invalid amount:', { amount });
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a positive number'
      });
    }

    // Validate customerId
    if (!customerId) {
      Logger.error('No customer ID found in request');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No customer ID found'
      });
    }

    const paymentResponse = await paymentService.initializeTransaction({
      amount, // Amount should be in GHS, will be converted to pesewas in the service
      email,
      orderId,
      customerId,
      metadata: {
        orderId,
        customerId
      }
    });

    res.json(paymentResponse);
  } catch (error) {
    Logger.error('Error initializing payment:', error);
    res.status(500).json({
      error: 'Payment initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        error: 'Missing reference',
        message: 'Payment reference is required'
      });
    }

    // Add logging to debug the reference
    Logger.info('Verifying payment with reference:', reference);

    const verification = await paymentService.verifyTransaction(reference);
    res.json(verification);
  } catch (error) {
    Logger.error('Error verifying payment:', error);
    res.status(500).json({
      error: 'Payment verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // Get the signature from headers
    const signature = req.headers['x-paystack-signature'];
    const event = req.body;

    Logger.debug('Received webhook:', { 
      event,
      signature,
      headers: req.headers
    });

    if (!signature) {
      Logger.warn('Webhook received without signature');
      return res.status(400).json({ error: 'No signature provided' });
    }

    // Validate webhook payload
    if (!event || !event.data) {
      Logger.warn('Invalid webhook payload');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    await paymentService.handleWebhook(event, signature as string);
    
    // Always return 200 to Paystack
    res.status(200).json({ received: true });
  } catch (error) {
    Logger.error('Webhook error:', error);
    // Still return 200 to prevent Paystack from retrying
    // but log the error for our monitoring
    res.status(200).json({ 
      received: true,
      warning: 'Processed with errors'
    });
  }
};
