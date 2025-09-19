import { Router } from 'express';
import multer from 'multer';
import { UploadController } from '@/controllers/upload.controller';
import { authMiddleware } from '@/middleware/auth-middleware';

const router = Router();
const uploadController = new UploadController();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * POST /upload/image
 * Upload an image file directly
 */
router.post('/image', upload.single('image'), uploadController.uploadImage.bind(uploadController));

/**
 * POST /upload/presigned-url
 * Generate a presigned URL for direct upload to S3
 */
router.post('/presigned-url', uploadController.generatePresignedUrl.bind(uploadController));

/**
 * POST /upload/presigned-download-url
 * Generate a presigned URL for downloading from S3
 */
router.post('/presigned-download-url', uploadController.generatePresignedDownloadUrl.bind(uploadController));

/**
 * DELETE /upload/image/:key
 * Delete an image from S3
 */
router.delete('/image/:key', uploadController.deleteImage.bind(uploadController));

export default router;