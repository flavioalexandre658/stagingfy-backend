import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';

// Validate required environment variables
const requiredEnvVars = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    logger.warn(`Missing required environment variable: ${key}`);
  }
}

// S3 Client configuration
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET || 'stagingfy-images';

// S3 Service class
export class S3Service {
  private bucket: string;

  constructor(bucket: string = S3_BUCKET) {
    this.bucket = bucket;
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await s3Client.send(command);
      
      const fileUrl = `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      logger.info(`File uploaded successfully to S3: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      logger.error(`Failed to upload file to S3: ${key}`, error as Error);
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a presigned URL for uploading
   */
  async getPresignedUploadUrl(
    key: string,
    contentType?: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      logger.info(`Generated presigned upload URL for: ${key}`);
      return presignedUrl;
    } catch (error) {
      logger.error(`Failed to generate presigned upload URL: ${key}`, error as Error);
      throw new Error(`Failed to generate presigned URL: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a presigned URL for downloading
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      logger.info(`Generated presigned download URL for: ${key}`);
      return presignedUrl;
    } catch (error) {
      logger.error(`Failed to generate presigned download URL: ${key}`, error as Error);
      throw new Error(`Failed to generate presigned URL: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await s3Client.send(command);
      
      logger.info(`File deleted successfully from S3: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete file from S3: ${key}`, error as Error);
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a unique key for a file
   */
  generateFileKey(userId: string, type: 'input' | 'output', extension: string = 'jpg'): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    return `${type}/${userId}/${timestamp}-${randomId}.${extension}`;
  }

  /**
   * Get the public URL for a file
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
}

// Export a default instance
export const s3Service = new S3Service();

export default s3Service;