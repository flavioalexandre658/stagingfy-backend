import { Router } from 'express';
import { virtualStagingController } from '../controllers/virtual-staging.controller';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

// Aplicar middleware de autenticação a todas as rotas
router.use(authMiddleware);

/**
 * @route POST /api/v1/virtual-staging
 * @desc Processa virtual staging usando ChatGPT + flux-kontext-pro
 * @access Private
 * @body { roomType: string, furnitureStyle: string, plan?: string }
 * @file image (multipart/form-data)
 * @description Pipeline: ChatGPT analisa imagem → gera prompt refinado → flux-kontext-pro processa → retorna staging
 */
router.post(
  '/',
  virtualStagingController.uploadMiddleware,
  virtualStagingController.processVirtualStaging.bind(virtualStagingController)
);

/**
 * @route GET /api/v1/virtual-staging/:uploadId/status
 * @desc Busca o status de um processamento de virtual staging
 * @access Private
 * @params uploadId: string
 */
router.get(
  '/:uploadId/status',
  virtualStagingController.getVirtualStagingStatus.bind(virtualStagingController)
);

/**
 * @route GET /api/v1/virtual-staging/user
 * @desc Lista todos os processamentos de virtual staging do usuário autenticado
 * @access Private
 * @query limit?: number (default: 20)
 */
router.get(
  '/user',
  virtualStagingController.getUserVirtualStagings.bind(virtualStagingController)
);

export default router;