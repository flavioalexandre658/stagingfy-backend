import Stripe from 'stripe';
import { logger } from './logger';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
});

// Webhook endpoint secret for verifying webhook signatures
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET) {
  logger.warn('STRIPE_WEBHOOK_SECRET not configured - webhook signature verification will be skipped');
}

// Common Stripe configuration
export const STRIPE_CONFIG = {
  currency: 'usd',
  billing_address_collection: 'auto' as const,
  payment_method_types: ['card'],
  mode: 'subscription' as const,
} as const;

export default stripe;