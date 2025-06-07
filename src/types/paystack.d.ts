declare module 'paystack-api' {
  interface PaystackTransaction {
    initialize(params: {
      amount: number;
      email: string;
      reference?: string;
      metadata?: Record<string, any>;
      callback_url?: string;
    }): Promise<{
      status: boolean;
      message: string;
      data: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    }>;

    verify(params: {
      reference: string;
    }): Promise<{
      status: boolean;
      message: string;
      data: {
        status: string;
        reference: string;
        amount: number;
        metadata: Record<string, any>;
        channel: string;
        currency: string;
        paid_at: string;
        authorization: Record<string, any>;
      };
    }>;
  }

  interface PaystackClient {
    transaction: PaystackTransaction;
  }

  function paystack(secretKey: string): PaystackClient;
  export = paystack;
}
