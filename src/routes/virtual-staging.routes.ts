import { Router } from 'express';
import { virtualStagingController } from '../controllers/virtual-staging.controller';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

// Aplicar middleware de autenticação a todas as rotas
router.use(authMiddleware);

/**
 * @route POST /api/v1/virtual-staging
 * @desc Processa virtual staging em 3 etapas usando Black Forest provider
 * @access Private
 * @body { roomType: string, furnitureStyle: string, plan?: string }
 * @file image (multipart/form-data)
 * @description Pipeline em 3 etapas: foundation → complement → final
 * @note Processamento assíncrono com logs detalhados de cada etapa
 */
router.post(
  '/',
  virtualStagingController.debugMiddleware,
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

/**
 * @route POST /api/v1/virtual-staging/default
 * @desc Processa virtual staging usando método padrão (processamento antigo)
 * @access Private
 * @body { roomType: string, furnitureStyle: string, plan?: string }
 * @file image (multipart/form-data)
 * @description Pipeline tradicional: ChatGPT analisa imagem → gera prompt refinado → provider processa → retorna staging
 * @note Processamento simples sem etapas, compatível com todos os providers
 */
router.post(
  '/default',
  virtualStagingController.debugMiddleware,
  virtualStagingController.uploadMiddleware,
  virtualStagingController.processVirtualStagingDefault.bind(virtualStagingController)
);

/**
 * @route POST /api/v1/virtual-staging/:uploadId/stages
 * @desc Processa virtual staging em etapas usando Black Forest provider
 * @access Private
 * @params uploadId: string
 * @body { webhookUrl?: string, enableProgress?: boolean }
 */
router.post(
  '/:uploadId/stages',
  virtualStagingController.processVirtualStagingInStages.bind(virtualStagingController)
);

export default router;