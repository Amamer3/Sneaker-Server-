import paystack from 'paystack-api';
import { FirestoreService } from '../utils/firestore';
import { COLLECTIONS } from '../constants/collections';
import Logger from '../utils/logger';
import { Order } from '../models/Order';

// Initialize Paystack
const paystackClient = paystack(process.env.PAYSTACK_SECRET_KEY!);

export interface InitializePaymentDTO {
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

type PaymentStatus = 'pending' | 'paid' | 'failed';

interface PaymentDetails {
  provider: 'paystack';
  reference: string;
  status: string;
  channel: string;
  paidAt: string;
  currency: string;
}

export const paymentService = {
  async initializeTransaction(params: InitializePaymentDTO): Promise<PaymentResponse> {
    try {
      Logger.debug('Initializing payment transaction', params);

      const { amount, email, orderId, customerId, reference, metadata = {} } = params;

      // Convert amount to kobo (Paystack uses kobo)
      const amountInKobo = Math.round(amount * 100);

      // Initialize transaction with Paystack
      const response = await paystackClient.transaction.initialize({
        amount: amountInKobo,
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
      await FirestoreService.collection(COLLECTIONS.ORDERS).doc(orderId).update({
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
      await FirestoreService.collection(COLLECTIONS.ORDERS).doc(orderId).update({
        paymentStatus: status === 'success' ? 'paid' : 'failed' as PaymentStatus,
        paidAmount: amount / 100, // Convert back from kobo to main currency
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

  async handleWebhook(body: any, signature: string): Promise<void> {
    try {
      // Paystack doesn't provide webhook event verification out of the box
      // You may want to implement your own verification logic here
      const event = body;

      Logger.debug('Processing payment webhook', { event });

      const { event: eventType, data } = event;

      switch (eventType) {
        case 'charge.success':
          await this.verifyTransaction(data.reference);
          break;
          
        case 'transfer.success':
          // Handle successful transfers if needed
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
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

const ordersCollection = FirestoreService.collection(COLLECTIONS.ORDERS);
const paymentsCollection = FirestoreService.collection('payments');

export const paymentService = {
  async createPaymentIntent({
    amount,
    currency,
    orderId,
    customerId,
    description,
    metadata
  }: CreatePaymentIntentDTO): Promise<PaymentIntent> {
    try {
      Logger.info(`Creating payment intent for order ${orderId}`);

      // Create a payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          orderId,
          customerId,
          ...metadata
        },
        description: description || `Payment for order ${orderId}`,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Store payment intent in Firestore
      await paymentsCollection.doc(paymentIntent.id).set({
        orderId,
        customerId,
        amount,
        currency,
        status: paymentIntent.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update order with payment intent ID
      await ordersCollection.doc(orderId).update({
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      Logger.error('Error creating payment intent:', error);
      throw error;
    }
  },

  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      Logger.info(`Processing Stripe webhook event: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const { orderId } = paymentIntent.metadata;

          // Update payment record
          await paymentsCollection.doc(paymentIntent.id).update({
            status: paymentIntent.status,
            updatedAt: new Date(),
          });

          // Update order status
          if (orderId) {
            await ordersCollection.doc(orderId).update({
              status: 'confirmed',
              paymentStatus: 'paid',
              updatedAt: new Date(),
            });
          }

          Logger.info(`Payment succeeded for order ${orderId}`);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const { orderId } = paymentIntent.metadata;

          // Update payment record
          await paymentsCollection.doc(paymentIntent.id).update({
            status: paymentIntent.status,
            updatedAt: new Date(),
            error: paymentIntent.last_payment_error,
          });

          // Update order status
          if (orderId) {
            await ordersCollection.doc(orderId).update({
              status: 'payment_failed',
              paymentStatus: 'failed',
              updatedAt: new Date(),
            });
          }

          Logger.error(`Payment failed for order ${orderId}`);
          break;
        }
      }
    } catch (error) {
      Logger.error('Error processing webhook:', error);
      throw error;
    }
  },

  async getPaymentStatus(paymentIntentId: string): Promise<string> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status;
    } catch (error) {
      Logger.error('Error getting payment status:', error);
      throw error;
    }
  }
};
