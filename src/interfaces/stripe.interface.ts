export interface StripeCustomer {
  id: string;
  email: string;
  name?: string | undefined;
  metadata?: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        nickname?: string;
        unit_amount: number;
        currency: string;
        recurring?: {
          interval: 'month' | 'year';
          interval_count: number;
        };
      };
    }>;
  };
  metadata?: Record<string, string>;
}

export interface StripePrice {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring?: {
    interval: 'month' | 'year';
    interval_count: number;
  };
  nickname?: string;
  active: boolean;
}

export interface StripeProduct {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  metadata?: Record<string, string>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
}

export interface CreateCheckoutSessionParams {
  priceId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}