import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

// Queue names
export const QUEUE_NAMES = {
  IMAGE_PROCESSING: 'image-processing',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  WEBHOOK_PROCESSING: 'webhook-processing',
} as const;

// Connection configuration for BullMQ - use the same Redis instance
const connection = redis;

// Image Processing Queue
export const imageProcessingQueue = new Queue(QUEUE_NAMES.IMAGE_PROCESSING, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Email Notifications Queue
export const emailNotificationsQueue = new Queue(QUEUE_NAMES.EMAIL_NOTIFICATIONS, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 10,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Webhook Processing Queue
export const webhookProcessingQueue = new Queue(QUEUE_NAMES.WEBHOOK_PROCESSING, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1500,
    },
  },
});

// Queue Events for monitoring
export const imageProcessingQueueEvents = new QueueEvents(QUEUE_NAMES.IMAGE_PROCESSING, { connection });
export const emailNotificationsQueueEvents = new QueueEvents(QUEUE_NAMES.EMAIL_NOTIFICATIONS, { connection });
export const webhookProcessingQueueEvents = new QueueEvents(QUEUE_NAMES.WEBHOOK_PROCESSING, { connection });

// Event listeners for logging
imageProcessingQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Image processing job ${jobId} completed`);
});

imageProcessingQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Image processing job ${jobId} failed: ${failedReason}`);
});

emailNotificationsQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Email notification job ${jobId} completed`);
});

emailNotificationsQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Email notification job ${jobId} failed: ${failedReason}`);
});

webhookProcessingQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Webhook processing job ${jobId} completed`);
});

webhookProcessingQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Webhook processing job ${jobId} failed: ${failedReason}`);
});

// Export all queues
export const queues = {
  imageProcessing: imageProcessingQueue,
  emailNotifications: emailNotificationsQueue,
  webhookProcessing: webhookProcessingQueue,
};

export default queues;