import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/lib/queues';

export interface WebhookProcessingJobData {
  webhookType: 'stripe' | 'black_forest' | 'other';
  payload: Record<string, any>;
  headers: Record<string, string>;
  signature?: string;
  timestamp: number;
}

export interface WebhookProcessingJobResult {
  processed: boolean;
  action: string;
  processedAt: Date;
}

// Webhook processing worker
export const webhookProcessingWorker = new Worker<WebhookProcessingJobData, WebhookProcessingJobResult>(
  QUEUE_NAMES.WEBHOOK_PROCESSING,
  async (job: Job<WebhookProcessingJobData>) => {
    const { webhookType, payload, headers, signature, timestamp } = job.data;
    
    logger.info(`Processing ${webhookType} webhook with timestamp ${timestamp}`);
    
    try {
      let action = 'unknown';
      
      switch (webhookType) {
        case 'stripe':
          action = await processStripeWebhook(payload, signature);
          break;
        case 'black_forest':
          action = await processBlackForestWebhook(payload);
          break;
        default:
          action = await processGenericWebhook(payload);
          break;
      }
      
      const processedAt = new Date();
      
      logger.info(`${webhookType} webhook processed successfully with action: ${action}`);
      
      return {
        processed: true,
        action,
        processedAt,
      };
    } catch (error) {
      logger.error(`Failed to process ${webhookType} webhook:`, error as Error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process up to 2 webhook jobs concurrently
  }
);

async function processStripeWebhook(payload: Record<string, any>, signature?: string): Promise<string> {
  // TODO: Implement Stripe webhook processing
  // This will handle subscription updates, payment confirmations, etc.
  logger.info('Processing Stripe webhook:', payload.type);
  return `stripe_${payload.type}`;
}

async function processBlackForestWebhook(payload: Record<string, any>): Promise<string> {
  // TODO: Implement Black Forest Labs webhook processing
  // This will handle image generation completion notifications
  logger.info('Processing Black Forest webhook');
  return 'black_forest_image_completed';
}

async function processGenericWebhook(payload: Record<string, any>): Promise<string> {
  // TODO: Implement generic webhook processing
  logger.info('Processing generic webhook');
  return 'generic_webhook_processed';
}

webhookProcessingWorker.on('completed', (job) => {
  logger.info(`Webhook processing worker completed job ${job.id}`);
});

webhookProcessingWorker.on('failed', (job, err) => {
  logger.error(`Webhook processing worker failed job ${job?.id}:`, err);
});

webhookProcessingWorker.on('error', (err) => {
  logger.error('Webhook processing worker error:', err);
});

export default webhookProcessingWorker;