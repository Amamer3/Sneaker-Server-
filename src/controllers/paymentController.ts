import { Request, Response } from 'express';
import { paymentService } from '../services/paymentService';
import Logger from '../utils/logger';
import { Order } from '../models/Order';

export const initializePayment = async (req: Request, res: Response) => {
  try {
    const { amount, orderId } = req.body;
    const customerId = (req as any).user.id;
    const email = (req as any).user.email;

    if (!amount || !orderId || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Amount, orderId, and email are required'
      });
    }

    const paymentResponse = await paymentService.initializeTransaction({
      amount,
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
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      Logger.warn('Webhook received without signature');
    }

    await paymentService.handleWebhook(req.body, signature);
    
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
