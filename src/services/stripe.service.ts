import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import {
  StripeCustomer,
  CreateCheckoutSessionParams,
  CreatePortalSessionParams,
} from '@/interfaces/stripe.interface';

export class StripeService {
  /**
   * Create or retrieve a Stripe customer
   */
  static async createOrGetCustomer(email: string, name?: string, userId?: string): Promise<StripeCustomer> {
    try {
      // First, try to find existing customer by email
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];
        if (!customer || !customer.email) {
          throw new Error('Customer email is required');
        }
        logger.info(`Found existing Stripe customer: ${customer.id}`);
        return {
          id: customer.id,
          email: customer.email,
          name: customer.name || undefined,
          metadata: customer.metadata,
        };
      }

      // Create new customer
      const createParams: Stripe.CustomerCreateParams = {
        email,
      };
      
      if (name) {
        createParams.name = name;
      }
      
      if (userId) {
        createParams.metadata = { userId };
      }

      const customer = await stripe.customers.create(createParams);

      if (!customer.email) {
        throw new Error('Customer email is required');
      }

      logger.info(`Created new Stripe customer: ${customer.id}`);
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name || undefined,
        metadata: customer.metadata,
      };
    } catch (error) {
      logger.error('Error creating/getting Stripe customer:', error as any);
      throw new Error('Failed to create or retrieve customer');
    }
  }

  /**
   * Create a checkout session for subscription
   */
  static async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<string> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: STRIPE_CONFIG.mode,
        payment_method_types: ['card'],
        billing_address_collection: STRIPE_CONFIG.billing_address_collection,
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        allow_promotion_codes: true,
      };

      if (params.customerId) {
        sessionParams.customer = params.customerId;
      } else if (params.customerEmail) {
        sessionParams.customer_email = params.customerEmail;
      }

      if (params.metadata) {
        sessionParams.metadata = params.metadata;
        sessionParams.subscription_data = {
          metadata: params.metadata,
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      if (!session.url) {
        throw new Error('Failed to create checkout session URL');
      }

      logger.info(`Created checkout session: ${session.id}`);
      return session.url;
    } catch (error) {
      logger.error('Error creating checkout session:', error as any);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create a customer portal session
   */
  static async createPortalSession(params: CreatePortalSessionParams): Promise<string> {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: params.returnUrl,
      });

      logger.info(`Created portal session for customer: ${params.customerId}`);
      return session.url;
    } catch (error) {
      logger.error('Error creating portal session:', error as any);
      throw new Error('Failed to create portal session');
    }
  }

  /**
   * Get customer's active subscription
   */
  static async getCustomerSubscription(customerId: string): Promise<Stripe.Subscription | null> {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return null;
      }

      return subscriptions.data[0] || null;
    } catch (error) {
      logger.error('Error getting customer subscription:', error as any);
      throw new Error('Failed to get customer subscription');
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true): Promise<void> {
    try {
      if (cancelAtPeriodEnd) {
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        logger.info(`Subscription ${subscriptionId} will be canceled at period end`);
      } else {
        await stripe.subscriptions.cancel(subscriptionId);
        logger.info(`Subscription ${subscriptionId} canceled immediately`);
      }
    } catch (error) {
      logger.error('Error canceling subscription:', error as any);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Reactivate a subscription
   */
  static async reactivateSubscription(subscriptionId: string): Promise<void> {
    try {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      logger.info(`Subscription ${subscriptionId} reactivated`);
    } catch (error) {
      logger.error('Error reactivating subscription:', error as any);
      throw new Error('Failed to reactivate subscription');
    }
  }

  /**
   * Get all available prices/plans
   */
  static async getAvailablePrices(): Promise<Stripe.Price[]> {
    try {
      const prices = await stripe.prices.list({
        active: true,
        expand: ['data.product'],
      });

      return prices.data;
    } catch (error) {
      logger.error('Error getting available prices:', error as any);
      throw new Error('Failed to get available prices');
    }
  }

  /**
   * Get customer invoices
   */
  static async getCustomerInvoices(email: string, options?: { limit?: number; starting_after?: string }): Promise<Stripe.Invoice[]> {
    try {
      // Get customer first
      const customer = await this.createOrGetCustomer(email);
      
      const listParams: Stripe.InvoiceListParams = {
        customer: customer.id,
        limit: options?.limit || 10,
      };

      if (options?.starting_after) {
        listParams.starting_after = options.starting_after;
      }

      const invoices = await stripe.invoices.list(listParams);

      return invoices.data;
    } catch (error) {
      logger.error('Failed to get customer invoices', { email, error });
      throw new Error('Failed to retrieve customer invoices');
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      throw new Error('Invalid webhook signature');
    }
  }
}