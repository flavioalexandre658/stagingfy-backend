import { Router } from 'express';
import { StripeController } from '@/controllers/stripe.controller';
import { authMiddleware } from '@/middleware/auth-middleware';

const router = Router();
const stripeController = new StripeController();

/**
 * POST /stripe/create-checkout-session
 * Create a Stripe checkout session
 */
router.post('/create-checkout-session', authMiddleware, stripeController.createCheckoutSession.bind(stripeController));

/**
 * POST /stripe/create-portal-session
 * Create a Stripe customer portal session
 */
router.post('/create-portal-session', authMiddleware, stripeController.createPortalSession.bind(stripeController));

/**
 * GET /stripe/subscription
 * Get current user's subscription
 */
router.get('/subscription', authMiddleware, stripeController.getSubscription.bind(stripeController));

/**
 * POST /stripe/cancel-subscription
 * Cancel current user's subscription
 */
router.post('/cancel-subscription', authMiddleware, stripeController.cancelSubscription.bind(stripeController));

/**
 * POST /stripe/reactivate-subscription
 * Reactivate current user's subscription
 */
router.post('/reactivate-subscription', authMiddleware, stripeController.reactivateSubscription.bind(stripeController));

/**
 * GET /stripe/invoices
 * Get user's invoices with pagination
 */
router.get('/invoices', authMiddleware, stripeController.getCustomerInvoices.bind(stripeController));

/**
 * GET /stripe/prices
 * Get available subscription prices
 */
router.get('/prices', stripeController.getPrices.bind(stripeController));

/**
 * POST /stripe/webhook
 * Handle Stripe webhooks (no auth required)
 */
router.post('/webhook', stripeController.handleWebhook.bind(stripeController));

export default router;