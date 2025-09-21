import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

/**
 * @route POST /api/v1/webhooks/instant-deco
 * @desc Handle InstantDeco webhook responses
 * @access Public (webhook)
 * @body InstantDecoWebhookResponse
 */
router.post(
  '/instant-deco',
  webhookController.handleInstantDecoWebhook.bind(webhookController)
);

/**
 * @route POST /api/v1/webhooks/black-forest
 * @desc Handle Black Forest webhook responses
 * @access Public (webhook)
 * @body BlackForestWebhookResponse
 */
router.post(
  '/black-forest',
  webhookController.handleBlackForestWebhook.bind(webhookController)
);

export default router;