import { s3Service } from '@/lib/s3';
import { logger } from '@/lib/logger';
import { imageProcessingQueue } from '@/lib/queues';

export interface UploadImageOptions {
  userId: string;
  type: 'input' | 'output';
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadImageResult {
  key: string;
  url: string;
  presignedUrl?: string;
}

export class ImageUploadService {
  /**
   * Upload an image buffer to S3
   */
  async uploadImage(
    buffer: Buffer,
    options: UploadImageOptions
  ): Promise<UploadImageResult> {
    try {
      const { userId, type, contentType = 'image/jpeg', metadata } = options;
      
      // Generate unique key for the image
      const extension = this.getExtensionFromContentType(contentType);
      const key = s3Service.generateFileKey(userId, type, extension);
      
      // Upload to S3
      const url = await s3Service.uploadFile(key, buffer, contentType, {
        userId,
        type,
        uploadedAt: new Date().toISOString(),
        ...metadata,
      });

      // If it's an input image, queue for processing
      if (type === 'input') {
        await this.queueImageProcessing(key, userId);
      }

      logger.info(`Image uploaded successfully: ${key}`, { userId, type });

      return {
        key,
        url,
      };
    } catch (error) {
      logger.error(`Failed to upload image for user ${options.userId}`, error as Error);
      throw new Error(`Failed to upload image: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a presigned URL for direct upload
   */
  async generatePresignedUploadUrl(
    options: UploadImageOptions & { expiresIn?: number }
  ): Promise<UploadImageResult> {
    try {
      const { userId, type, contentType = 'image/jpeg', expiresIn = 3600 } = options;
      
      // Generate unique key for the image
      const extension = this.getExtensionFromContentType(contentType);
      const key = s3Service.generateFileKey(userId, type, extension);
      
      // Generate presigned URL
      const presignedUrl = await s3Service.getPresignedUploadUrl(
        key,
        contentType,
        expiresIn
      );

      const url = s3Service.getPublicUrl(key);

      logger.info(`Presigned upload URL generated: ${key}`, { userId, type });

      return {
        key,
        url,
        presignedUrl,
      };
    } catch (error) {
      logger.error(`Failed to generate presigned upload URL for user ${options.userId}`, error as Error);
      throw new Error(`Failed to generate presigned URL: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a presigned URL for download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const presignedUrl = await s3Service.getPresignedDownloadUrl(key, expiresIn);
      
      logger.info(`Presigned download URL generated: ${key}`);
      return presignedUrl;
    } catch (error) {
      logger.error(`Failed to generate presigned download URL for key ${key}`, error as Error);
      throw new Error(`Failed to generate presigned URL: ${(error as Error).message}`);
    }
  }

  /**
   * Delete an image from S3
   */
  async deleteImage(key: string): Promise<void> {
    try {
      await s3Service.deleteFile(key);
      logger.info(`Image deleted successfully: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete image with key ${key}`, error as Error);
      throw new Error(`Failed to delete image: ${(error as Error).message}`);
    }
  }

  /**
   * Queue image for processing
   */
  private async queueImageProcessing(key: string, userId: string): Promise<void> {
    try {
      await imageProcessingQueue.add(
        'process-image',
        {
          imageKey: key,
          userId,
          timestamp: Date.now(),
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      logger.info(`Image queued for processing: ${key}`, { userId });
    } catch (error) {
      logger.error(`Failed to queue image for processing: ${key} for user ${userId}`, error as Error);
      // Don't throw here as the upload was successful
    }
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const typeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    return typeMap[contentType.toLowerCase()] || 'jpg';
  }

  /**
   * Validate image file
   */
  validateImageFile(buffer: Buffer, contentType: string): boolean {
    // Check content type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      throw new Error('File size too large. Maximum size is 10MB.');
    }

    // Basic file signature validation
    const signatures: Record<string, number[]> = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
    };

    const signature = signatures[contentType.toLowerCase()];
    if (signature) {
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          throw new Error('Invalid file signature. File may be corrupted or not a valid image.');
        }
      }
    }

    return true;
  }
}

// Export a default instance
export const imageUploadService = new ImageUploadService();

export default imageUploadService;