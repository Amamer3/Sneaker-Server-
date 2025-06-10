declare module 'paystack-api' {
  interface PaystackResponse<T = any> {
    status: boolean;
    message: string;
    data: T;
  }

  interface PaystackCustomer {
    id: number;
    first_name?: string;
    last_name?: string;
    email: string;
    phone?: string;
    metadata?: Record<string, any>;
    risk_action?: string;
    created_at: string;
  }

  interface PaystackAuthorization {
    authorization_code: string;
    card_type: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    bin: string;
    bank: string;
    channel: string;
    signature: string;
    reusable: boolean;
    country_code: string;
  }

  interface PaystackTransactionData {
    id: number;
    status: string;
    reference: string;
    amount: number;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: Record<string, any>;
    customer: PaystackCustomer;
    authorization?: PaystackAuthorization;
  }

  interface PaystackInitializeData {
    authorization_url: string;
    access_code: string;
    reference: string;
  }

  interface PaystackInitializeParams {
    amount: number;
    email: string;
    currency?: string;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    channels?: string[];
  }

  interface PaystackTransaction {
    initialize(params: PaystackInitializeParams): Promise<PaystackResponse<PaystackInitializeData>>;
    verify(reference: string): Promise<PaystackResponse<PaystackTransactionData>>;
    list(params?: {
      perPage?: number;
      page?: number;
      status?: 'failed' | 'success' | 'abandoned';
      from?: string;
      to?: string;
      customer?: number;
    }): Promise<PaystackResponse<PaystackTransactionData[]>>;
  }

  interface PaystackCustomerAPI {
    create(params: {
      email: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      metadata?: Record<string, any>;
    }): Promise<PaystackResponse<PaystackCustomer>>;

    list(params?: {
      perPage?: number;
      page?: number;
      from?: string;
      to?: string;
    }): Promise<PaystackResponse<PaystackCustomer[]>>;

    fetch(email_or_code: string): Promise<PaystackResponse<PaystackCustomer>>;
  }

  interface PaystackAPI {
    transaction: PaystackTransaction;
    customer: PaystackCustomerAPI;
  }

  function paystack(secretKey: string): PaystackAPI;
  export = paystack;
}
