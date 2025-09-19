import { Request, Response } from 'express';
import { BaseController } from './base.controller';
import { AuthenticatedRequest } from '@/middleware/auth-middleware';
import { StripeService } from '@/services/stripe.service';
import { logger } from '@/lib/logger';

export class StripeController extends BaseController {
  /**
   * Create checkout session
   */
  async createCheckoutSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { priceId, successUrl, cancelUrl } = req.body;

      // Validate required fields
      if (!priceId) {
        this.validationError(res, { priceId: 'Price ID is required' });
        return;
      }

      if (!successUrl) {
        this.validationError(res, { successUrl: 'Success URL is required' });
        return;
      }

      if (!cancelUrl) {
        this.validationError(res, { cancelUrl: 'Cancel URL is required' });
        return;
      }

      // Create checkout session
      const sessionUrl = await StripeService.createCheckoutSession({
        priceId,
        successUrl,
        cancelUrl,
        customerEmail: user.email,
        metadata: {
          userId: user.id,
        },
      });

      this.success(res, {
        url: sessionUrl,
      }, 'Checkout session created successfully', 201);

    } catch (error) {
      this.error(res, 'Failed to create checkout session', 500, error);
    }
  }

  /**
   * Create customer portal session
   */
  async createPortalSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { returnUrl } = req.body;

      if (!returnUrl) {
        this.validationError(res, { returnUrl: 'Return URL is required' });
        return;
      }

      // Get or create customer first
      const customer = await StripeService.createOrGetCustomer(user.email, user.name, user.id);

      // Create portal session
      const portalUrl = await StripeService.createPortalSession({
        customerId: customer.id,
        returnUrl,
      });

      this.success(res, {
        url: portalUrl,
      }, 'Portal session created successfully', 201);

    } catch (error) {
      this.error(res, 'Failed to create portal session', 500, error);
    }
  }

  /**
   * Get customer subscription
   */
  async getSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Get or create customer first
      const customer = await StripeService.createOrGetCustomer(user.email, user.name, user.id);

      // Get subscription
      const subscription = await StripeService.getCustomerSubscription(customer.id);

      this.success(res, {
        subscription,
      }, 'Subscription retrieved successfully');

    } catch (error) {
      this.error(res, 'Failed to get subscription', 500, error);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { cancelAtPeriodEnd = true } = req.body;

      if (!subscriptionId) {
        this.validationError(res, { subscriptionId: 'Subscription ID is required' });
        return;
      }

      // Cancel subscription
      await StripeService.cancelSubscription(subscriptionId, cancelAtPeriodEnd);

      this.success(res, null, 'Subscription cancelled successfully');

    } catch (error) {
      this.error(res, 'Failed to cancel subscription', 500, error);
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      if (!subscriptionId) {
        this.validationError(res, { subscriptionId: 'Subscription ID is required' });
        return;
      }

      // Reactivate subscription
      await StripeService.reactivateSubscription(subscriptionId);

      this.success(res, null, 'Subscription reactivated successfully');

    } catch (error) {
      this.error(res, 'Failed to reactivate subscription', 500, error);
    }
  }

  /**
   * Get available prices
   */
  async getPrices(req: Request, res: Response): Promise<void> {
    try {
      // Get available prices
      const prices = await StripeService.getAvailablePrices();

      this.success(res, {
        prices,
      }, 'Prices retrieved successfully');

    } catch (error) {
      this.error(res, 'Failed to get prices', 500, error);
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      if (!signature) {
        this.validationError(res, { signature: 'Stripe signature is required' });
        return;
      }

      // Verify webhook signature
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }

      const event = StripeService.verifyWebhookSignature(
        payload,
        signature,
        webhookSecret
      );

      // Log the event
      logger.info('Stripe webhook received', { 
        type: event.type, 
        id: event.id 
      });

      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
          logger.info('Subscription created', { data: event.data.object as any });
          break;
        case 'customer.subscription.updated':
          logger.info('Subscription updated', { data: event.data.object as any });
          break;
        case 'customer.subscription.deleted':
          logger.info('Subscription deleted', { data: event.data.object as any });
          break;
        case 'invoice.payment_succeeded':
          logger.info('Payment succeeded', { data: event.data.object as any });
          break;
        case 'invoice.payment_failed':
          logger.info('Payment failed', { data: event.data.object as any });
          break;
        default:
          logger.info('Unhandled event type', { type: event.type });
      }

      // Respond to Stripe
      res.status(200).json({ received: true });

    } catch (error) {
      logger.error('Webhook processing failed', { error: error as any });
      this.error(res, 'Webhook processing failed', 400, error);
    }
  }

  /**
   * Get customer details
   */
  async getCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Get or create customer
      const customer = await StripeService.createOrGetCustomer(user.email, user.name, user.id);

      this.success(res, {
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          metadata: customer.metadata,
        },
      }, 'Customer retrieved successfully');

    } catch (error) {
      this.error(res, 'Failed to get customer', 500, error);
    }
  }

  /**
   * Get customer invoices
   */
  async getCustomerInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { limit = 10, starting_after } = req.query;

      const invoices = await StripeService.getCustomerInvoices(user.email, {
        limit: Number(limit),
        starting_after: starting_after as string
      });
      
      this.success(res, invoices, 'Invoices retrieved successfully');
    } catch (error) {
      this.error(res, 'Failed to get invoices', 500, error);
    }
  }
}