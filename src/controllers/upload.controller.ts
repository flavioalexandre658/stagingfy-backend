import { Request, Response } from 'express';
import { BaseController } from './base.controller';
import { AuthenticatedRequest } from '@/middleware/auth-middleware';
import { s3Service } from '@/lib/s3';
import { logger } from '@/lib/logger';

export class UploadController extends BaseController {
  /**
   * Upload image to S3
   */
  async uploadImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        this.validationError(res, { file: 'No file uploaded' });
        return;
      }

      const user = req.user!;
      const file = req.file;

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        this.validationError(res, { 
          file: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' 
        });
        return;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        this.validationError(res, { 
          file: 'File too large. Maximum size is 10MB' 
        });
        return;
      }

      // Generate file key and upload to S3
      const fileExtension = file.mimetype.split('/')[1];
      const key = s3Service.generateFileKey(user.id, 'input', fileExtension);
      
      await s3Service.uploadFile(key, file.buffer, file.mimetype);
      const url = s3Service.getPublicUrl(key);

      this.success(res, {
        key,
        url,
        size: file.size,
        mimetype: file.mimetype,
      }, 'Image uploaded successfully', 201);

    } catch (error) {
      this.error(res, 'Failed to upload image', 500, error);
    }
  }

  /**
   * Generate presigned URL for upload
   */
  async generatePresignedUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { contentType } = req.body;
      const user = req.user!;

      if (!user.id) {
        this.unauthorized(res, 'User ID is required');
        return;
      }

      if (!contentType) {
        this.validationError(res, { contentType: 'Content type is required' });
        return;
      }

      // Validate content type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        this.validationError(res, { 
          contentType: 'Invalid content type. Only JPEG, PNG, and WebP are allowed' 
        });
        return;
      }

      const fileExtension = contentType.split('/')[1];
      const key = s3Service.generateFileKey(user.id, 'input', fileExtension);
      const uploadUrl = await s3Service.getPresignedUploadUrl(key, contentType);

      this.success(res, {
        uploadUrl,
        key,
        expiresIn: 3600, // 1 hour
      }, 'Presigned URL generated successfully');

    } catch (error) {
      this.error(res, 'Failed to generate presigned URL', 500, error);
    }
  }

  /**
   * Generate presigned download URL
   */
  async generatePresignedDownloadUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.body;

      if (!key) {
        this.validationError(res, { key: 'Key is required' });
        return;
      }

      const downloadUrl = await s3Service.getPresignedDownloadUrl(key);

      this.success(res, {
        downloadUrl,
        expiresIn: 3600, // 1 hour
      }, 'Presigned download URL generated successfully');

    } catch (error) {
      this.error(res, 'Failed to generate presigned download URL', 500, error);
    }
  }

  /**
   * Delete image from S3
   */
  async deleteImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        this.validationError(res, { key: 'Key is required' });
        return;
      }

      await s3Service.deleteFile(key);

      this.success(res, null, 'Image deleted successfully');

    } catch (error) {
      this.error(res, 'Failed to delete image', 500, error);
    }
  }
}