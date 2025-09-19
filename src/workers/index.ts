import { logger } from '@/lib/logger';
import imageProcessingWorker from './image-processing.worker';
import emailNotificationsWorker from './email-notifications.worker';
import webhookProcessingWorker from './webhook-processing.worker';

// Array of all workers
const workers = [
  imageProcessingWorker,
  emailNotificationsWorker,
  webhookProcessingWorker,
];

// Initialize all workers
export const initializeWorkers = async () => {
  try {
    logger.info('Initializing BullMQ workers...');
    
    // Start all workers
    await Promise.all(workers.map(worker => worker.waitUntilReady()));
    
    logger.info(`Successfully initialized ${workers.length} workers`);
  } catch (error) {
    logger.error('Failed to initialize workers:', error as Error);
    throw error;
  }
};

// Gracefully close all workers
export const closeWorkers = async () => {
  try {
    logger.info('Closing BullMQ workers...');
    
    await Promise.all(workers.map(worker => worker.close()));
    
    logger.info('All workers closed successfully');
  } catch (error) {
    logger.error('Error closing workers:', error as Error);
    throw error;
  }
};

// Export workers for direct access if needed
export {
  imageProcessingWorker,
  emailNotificationsWorker,
  webhookProcessingWorker,
};

export default {
  initialize: initializeWorkers,
  close: closeWorkers,
  workers,
};