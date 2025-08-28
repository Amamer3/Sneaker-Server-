import axios from 'axios';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import Logger from '../utils/logger';

// Paystack API configuration
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const paystackHeaders = {
  'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
};

if (!process.env.PAYSTACK_SECRET_KEY) {
  Logger.warn('PAYSTACK_SECRET_KEY environment variable is not set - payment functionality will be disabled');
}

// Paystack API response interfaces
interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface PaystackVerifyResponse {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  channel: string;
  paid_at: string;
  metadata: Record<string, any>;
}

type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface InitializePaymentDTO {
  /**
   * Amount in Ghana Cedis (GHS)
   * Will be converted to pesewas (1 GHS = 100 pesewas) for Paystack
   * Example: 100.50 GHS will be sent as 10050 pesewas
   */
  amount: number;
  email: string;
  orderId: string;
  customerId: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}

export interface PaymentVerification {
  status: string;
  reference: string;
  amount: number;
  orderId: string;
  metadata: Record<string, any>;
}

interface PaymentDetails {
  provider: 'paystack';
  reference: string;
  status: string;
  channel: string;
  paidAt: string;
  currency: string;
}

const ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);

export const paymentService = {
  async initializeTransaction(params: InitializePaymentDTO): Promise<PaymentResponse> {
    try {
      Logger.debug('Initializing payment transaction', params);
      
      if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
      }
      
      const { amount, email, orderId, customerId, reference, metadata = {} } = params;
      
      // Convert amount to pesewas (Paystack requires amount in smallest currency unit)
      // 1 GHS = 100 pesewas, so multiply by 100 to get the amount in pesewas
      const amountInPesewas = Math.round(amount * 100);
      
      // Initialize transaction with Paystack API
       const response = await axios.post<PaystackApiResponse<PaystackInitializeResponse>>(
         `${PAYSTACK_BASE_URL}/transaction/initialize`,
         {
           amount: amountInPesewas,
           email,
           reference,
           metadata: {
             orderId,
             customerId,
             ...metadata
           },
           callback_url: process.env.PAYSTACK_CALLBACK_URL,
           currency: 'GHS'
         },
         { headers: paystackHeaders }
       );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Payment initialization failed');
      }

      // Update order with payment reference
      await ordersCollection.doc(orderId).update({
        paymentReference: response.data.data.reference,
        paymentStatus: 'pending',
        updatedAt: new Date()
      });

      return {
        authorizationUrl: response.data.data.authorization_url,
        reference: response.data.data.reference,
        accessCode: response.data.data.access_code
      };
    } catch (error: any) {
      Logger.error('Error initializing payment:', error);
      if (error.response && error.response.data) {
        throw new Error(error.response.data.message || 'Payment initialization failed');
      }
      throw error;
    }
  },
  async verifyTransaction(reference: string): Promise<PaymentVerification> {
    try {
      Logger.debug('Verifying payment transaction', { reference });

      if (!reference) {
        throw new Error('Payment reference is required');
      }

      if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
      }

      const response = await axios.get<PaystackApiResponse<PaystackVerifyResponse>>(
         `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
         { headers: paystackHeaders }
       );
      
      Logger.debug('Paystack verification response:', { status: response.data.status, message: response.data.message });

      if (!response.data.status) {
        throw new Error(response.data.message || 'Payment verification failed');
      }

      if (!response.data.data) {
        throw new Error('No transaction data returned from Paystack');
      }

      const { metadata = {}, amount, status } = response.data.data;
      const orderId = metadata.orderId as string;

      if (!orderId) {
        Logger.warn('Order ID not found in payment metadata', { metadata, reference });
        throw new Error('Order ID not found in payment metadata');
      }

      const paymentDetails: PaymentDetails = {
        provider: 'paystack',
        reference,
        status,
        channel: response.data.data.channel || 'unknown',
        paidAt: response.data.data.paid_at || new Date().toISOString(),
        currency: response.data.data.currency || 'GHS'
      };

      // Update order with payment status
      await ordersCollection.doc(orderId).update({
        paymentStatus: status === 'success' ? 'paid' : 'failed',
        paidAmount: amount / 100, // Convert back from pesewas to GHS
        paymentDetails,
        updatedAt: new Date()
      });

      return {
        status: response.data.data.status,
        reference: response.data.data.reference,
        amount: response.data.data.amount / 100,
        orderId,
        metadata: metadata
      };
    } catch (error: any) {
      Logger.error('Error verifying payment:', {
        error: error instanceof Error ? error.message : error,
        reference,
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error.response && error.response.data) {
        throw new Error(error.response.data.message || 'Payment verification failed');
      }
      throw error;
    }
  },  async handleWebhook(body: Record<string, any>, signature?: string): Promise<void> {
    try {
      // Verify webhook signature if provided
      if (process.env.PAYSTACK_SECRET_KEY && signature) {
        const crypto = require('crypto');
        const hash = crypto
          .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
          .update(JSON.stringify(body))
          .digest('hex');
        
        if (hash !== signature) {
          throw new Error('Invalid webhook signature');
        }
      }

      Logger.debug('Processing payment webhook', { event: body });

      const { event: eventType, data } = body;

      switch (eventType) {
        case 'charge.success':
          await this.verifyTransaction(data.reference);
          Logger.info('Payment successful for reference:', data.reference);
          break;
          
        case 'charge.failed':
          // Update order status to failed
          const orderId = data.metadata?.orderId;
          if (orderId) {
            const paymentDetails: PaymentDetails = {
              provider: 'paystack',
              reference: data.reference,
              status: 'failed',
              channel: data.channel || 'unknown',
              paidAt: new Date().toISOString(),
              currency: data.currency || 'GHS'
            };
            
            await ordersCollection.doc(orderId).update({
              paymentStatus: 'failed',
              updatedAt: new Date(),
              paymentDetails,
              failureReason: data.gateway_response || 'Payment failed'
            });
          }
          Logger.warn('Payment failed for reference:', data.reference);
          break;

        default:
          Logger.debug(`Unhandled payment webhook event: ${eventType}`);
      }
    } catch (error) {
      Logger.error('Error processing payment webhook:', error);
      throw error;
    }
  }
};
