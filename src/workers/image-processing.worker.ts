import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/lib/queues';

export interface ImageProcessingJobData {
  jobId: string;
  userId: string;
  inputImageUrl: string;
  prompt: string;
  roomTypeId: string;
  furnitureStyleId: string;
  loraId?: string;
  model: string;
}

export interface ImageProcessingJobResult {
  outputImageUrl: string;
  creditsUsed: number;
  processingTime: number;
}

// Image processing worker
export const imageProcessingWorker = new Worker<ImageProcessingJobData, ImageProcessingJobResult>(
  QUEUE_NAMES.IMAGE_PROCESSING,
  async (job: Job<ImageProcessingJobData>) => {
    const { jobId, userId, inputImageUrl, prompt, roomTypeId, furnitureStyleId, loraId, model } = job.data;
    
    logger.info(`Starting image processing job ${jobId} for user ${userId}`);
    
    try {
      const startTime = Date.now();
      
      // TODO: Implement actual image processing logic
      // This will integrate with Black Forest Labs API (Flux)
      // For now, we'll simulate the processing
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate processing time
      
      const processingTime = Date.now() - startTime;
      const outputImageUrl = `https://example.com/processed-images/${jobId}.jpg`;
      const creditsUsed = 1; // This will be calculated based on the model and processing complexity
      
      logger.info(`Image processing job ${jobId} completed in ${processingTime}ms`);
      
      return {
        outputImageUrl,
        creditsUsed,
        processingTime,
      };
    } catch (error) {
      logger.error(`Image processing job ${jobId} failed:`, error as Error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 3, // Process up to 3 jobs concurrently
  }
);

imageProcessingWorker.on('completed', (job) => {
  logger.info(`Image processing worker completed job ${job.id}`);
});

imageProcessingWorker.on('failed', (job, err) => {
  logger.error(`Image processing worker failed job ${job?.id}:`, err);
});

imageProcessingWorker.on('error', (err) => {
  logger.error('Image processing worker error:', err);
});

export default imageProcessingWorker;