import paystack from 'paystack-api';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import Logger from '../utils/logger';

// Initialize Paystack
const paystackClient = paystack(process.env.PAYSTACK_SECRET_KEY!);

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
      Logger.debug('Initializing payment transaction', params);      const { amount, email, orderId, customerId, reference, metadata = {} } = params;
      
      // Convert amount to pesewas (Paystack requires amount in smallest currency unit)
      // 1 GHS = 100 pesewas, so multiply by 100 to get the amount in pesewas
      const amountInPesewas = Math.round(amount * 100);

      // Initialize transaction with Paystack
      const response = await paystackClient.transaction.initialize({
        amount: amountInPesewas,
        email,
        reference,
        metadata: {
          orderId,
          customerId,
          ...metadata
        },
        callback_url: process.env.PAYSTACK_CALLBACK_URL
      });

      if (!response.status) {
        throw new Error(response.message || 'Payment initialization failed');
      }

      // Update order with payment reference
      await ordersCollection.doc(orderId).update({
        paymentReference: response.data.reference,
        paymentStatus: 'pending' as PaymentStatus,
        updatedAt: new Date()
      });

      return {
        authorizationUrl: response.data.authorization_url,
        reference: response.data.reference,
        accessCode: response.data.access_code
      };
    } catch (error) {
      Logger.error('Error initializing payment:', error);
      throw error;
    }
  },

  async verifyTransaction(reference: string): Promise<PaymentVerification> {
    try {
      Logger.debug('Verifying payment transaction', { reference });

      const response = await paystackClient.transaction.verify({ reference });

      if (!response.status) {
        throw new Error(response.message || 'Payment verification failed');
      }

      const { metadata, amount, status } = response.data;
      const { orderId } = metadata;

      const paymentDetails: PaymentDetails = {
        provider: 'paystack',
        reference,
        status,
        channel: response.data.channel,
        paidAt: response.data.paid_at,
        currency: response.data.currency
      };

      // Update order with payment status
      await ordersCollection.doc(orderId).update({
        paymentStatus: status === 'success' ? 'paid' : 'failed' as PaymentStatus,
        paidAmount: amount / 100, // Convert back from pesewas to GHS
        paymentDetails,
        updatedAt: new Date()
      });

      return {
        status: response.data.status,
        reference: response.data.reference,
        amount: response.data.amount / 100,
        orderId,
        metadata: response.data.metadata
      };
    } catch (error) {
      Logger.error('Error verifying payment:', error);
      throw error;
    }
  },
  async handleWebhook(body: Record<string, any>, signature?: string): Promise<void> {
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
          if (data.metadata?.orderId) {
            await ordersCollection.doc(data.metadata.orderId).update({
              paymentStatus: 'failed' as PaymentStatus,
              updatedAt: new Date(),
              paymentDetails: {
                provider: 'paystack',
                reference: data.reference,
                status: 'failed',
                failureReason: data.gateway_response || 'Payment failed'
              }
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
