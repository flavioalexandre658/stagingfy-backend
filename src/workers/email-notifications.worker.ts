import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/lib/queues';

export interface EmailNotificationJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface EmailNotificationJobResult {
  messageId: string;
  sentAt: Date;
}

// Email notifications worker
export const emailNotificationsWorker = new Worker<EmailNotificationJobData, EmailNotificationJobResult>(
  QUEUE_NAMES.EMAIL_NOTIFICATIONS,
  async (job: Job<EmailNotificationJobData>) => {
    const { to, subject, template, data, priority = 'normal' } = job.data;
    
    logger.info(`Sending email notification to ${to} with template ${template}`);
    
    try {
      // TODO: Implement actual email sending logic
      // This will integrate with a service like SendGrid, AWS SES, or similar
      // For now, we'll simulate the email sending
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate email sending time
      
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sentAt = new Date();
      
      logger.info(`Email notification sent to ${to} with messageId ${messageId}`);
      
      return {
        messageId,
        sentAt,
      };
    } catch (error) {
      logger.error(`Failed to send email notification to ${to}:`, error as Error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5, // Process up to 5 email jobs concurrently
  }
);

emailNotificationsWorker.on('completed', (job) => {
  logger.info(`Email notification worker completed job ${job.id}`);
});

emailNotificationsWorker.on('failed', (job, err) => {
  logger.error(`Email notification worker failed job ${job?.id}:`, err);
});

emailNotificationsWorker.on('error', (err) => {
  logger.error('Email notification worker error:', err);
});

export default emailNotificationsWorker;