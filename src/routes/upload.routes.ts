import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

// Aplicar middleware de autenticação a todas as rotas
router.use(authMiddleware);

/**
 * @route POST /api/v1/upload
 * @desc Upload de imagem para processamento com IA
 * @access Private
 * @body { roomType: string, furnitureStyle: string, plan?: string }
 * @file image (multipart/form-data)
 */
router.post(
  '/',
  uploadController.uploadMiddleware,
  uploadController.uploadImage.bind(uploadController)
);

/**
 * @route GET /api/v1/upload/:uploadId/status
 * @desc Busca o status de um upload específico
 * @access Private
 * @params uploadId: string
 */
router.get(
  '/:uploadId/status',
  uploadController.getUploadStatus.bind(uploadController)
);

/**
 * @route GET /api/v1/upload/user
 * @desc Lista todos os uploads do usuário autenticado
 * @access Private
 * @query limit?: number (default: 20)
 */
router.get(
  '/user',
  uploadController.getUserUploads.bind(uploadController)
);

export default router;