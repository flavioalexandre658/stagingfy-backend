import { Request, Response } from 'express';
import { BaseController } from './base.controller';
import { uploadRepository } from '../repositories/upload.repository';
import { logger } from '../lib/logger';
import { InstantDecoWebhookResponse } from '../interfaces/instant-deco.interface';
import { BlackForestWebhookResponse } from '../interfaces/upload.interface';
import { InstantDecoProvider } from '../services/providers/instant-deco.provider';
import { ProviderConfig } from '../interfaces/virtual-staging-provider.interface';

export class WebhookController extends BaseController {
  private instantDecoProvider: InstantDecoProvider;

  constructor() {
    super();
    // Configuração básica para o provider
    const config: ProviderConfig = {
      apiKey: process.env.INSTANT_DECO_API_KEY || '',
      baseUrl:
        process.env.INSTANT_DECO_BASE_URL || 'https://api.instantdeco.com',
      webhookUrl: process.env.INSTANT_DECO_WEBHOOK_URL || '',
    };
    this.instantDecoProvider = new InstantDecoProvider(config);
  }

  /**
   * Handle InstantDeco webhook
   */
  async handleInstantDecoWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookData: InstantDecoWebhookResponse = req.body;

      logger.info('InstantDeco webhook received', {
        requestId: webhookData.request_id,
        status: webhookData.status,
      });

      // Processar resposta do webhook usando o provider InstantDeco
      const result =
        await this.instantDecoProvider.processWebhookResponse!(webhookData);

      if (result.success && (result.outputImageUrl || result.outputImageUrls)) {
        // Buscar upload pelo request_id
        const upload = await uploadRepository.findByInstantDecoRequestId(
          result.requestId!
        );

        if (upload) {
          // Atualizar com as imagens finais (múltiplas URLs quando disponíveis)
          await uploadRepository.updateOutputImage(
            upload.id,
            result.outputImageUrl ||
              (result.outputImageUrls && result.outputImageUrls[0]) ||
              '',
            result.outputImageUrls
          );
          await uploadRepository.updateStatus(upload.id, 'completed');
          logger.info('InstantDeco processing completed', { uploadId: upload.id, result });
        } else {
          logger.warn('Upload not found for InstantDeco request', {
            requestId: result.requestId,
          });
        }
      } else {
        // Buscar upload pelo request_id para marcar como falha
        const upload = await uploadRepository.findByInstantDecoRequestId(
          result.requestId!
        );

        if (upload) {
          await uploadRepository.updateStatus(
            upload.id,
            'failed',
            result.errorMessage
          );

          logger.error('InstantDeco processing failed', {
            uploadId: upload.id,
            requestId: result.requestId,
            error: result.errorMessage,
          });
        }
      }

      // Responder ao webhook
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('InstantDeco webhook processing failed', {
        error: error as any,
      });
      this.error(res, 'Webhook processing failed', 400, error);
    }
  }

  /**
   * Handle Black Forest webhook
   */
  async handleBlackForestWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Mapear task_id para jobId
      const webhookData = {
        jobId: req.body.task_id || req.body.id,
        status: req.body.status === 'SUCCESS' ? 'completed' : req.body.status,
        result: req.body.result,
        timestamp: new Date().toISOString()
      };

      logger.info('Black Forest webhook received', {
        jobId: webhookData.jobId,
        status: webhookData.status
      });

      if (!webhookData.jobId) {
        logger.warn('No job ID found in webhook payload');
        res.status(400).json({ error: 'No job ID found' });
        return;
      }

      // Buscar upload pelo jobId com retry para lidar com race condition
      const upload = await this.findUploadWithRetry(webhookData.jobId);
      
      if (!upload) {
        logger.warn('Upload not found for Black Forest job after retries', { jobId: webhookData.jobId });
        res.status(404).json({ error: 'Upload not found' });
        return;
      }

      // Se o job foi concluído com sucesso
      if (webhookData.status === 'completed' && webhookData.result?.sample) {
        const imageUrl = this.extractImageUrl(webhookData.result.sample);
        
        if (imageUrl && upload.currentStage && upload.stagingPlan) {
          logger.info(`Stage ${upload.currentStage} completed for upload ${upload.id}`);
          
          // Atualizar resultado da etapa atual
          await uploadRepository.updateStageResult(upload.id, {
            stage: upload.currentStage,
            imageUrl,
            success: true,
            validationPassed: true,
            retryCount: 0
          } as any);

          // Verificar se há próxima etapa
          const currentStageIndex = upload.stagingPlan.stages.findIndex((s: any) => s.stage === upload.currentStage);
          const nextStageIndex = currentStageIndex + 1;
          
          if (nextStageIndex < upload.stagingPlan.stages.length) {
            // Há próxima etapa - processar
            const nextStage = upload.stagingPlan.stages[nextStageIndex];
            if (nextStage) {
              logger.info(`Starting next stage ${nextStage.stage} for upload ${upload.id}`);
              await this.processNextStage(upload, imageUrl, nextStage, nextStageIndex);
            }
          } else {
            // Última etapa concluída - finalizar
            logger.info(`All stages completed for upload ${upload.id}`);
            await uploadRepository.updateStatus(upload.id, 'completed');
            await uploadRepository.updateOutputImage(upload.id, imageUrl, undefined);
          }
        }
      } else if (webhookData.status === 'failed') {
        logger.error(`Stage ${upload.currentStage} failed for upload ${upload.id}`);
        await uploadRepository.updateStatus(upload.id, 'failed');
      } else {
        // Status de processamento - apenas atualizar
        await uploadRepository.updateStatus(upload.id, webhookData.status);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Webhook processing failed:', error as Error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private extractImageUrl(sample: any): string | null {
    if (typeof sample === 'string') {
      return sample;
    }
    if (sample && typeof sample === 'object' && sample.url) {
      return sample.url;
    }
    return null;
  }

  private async findUploadWithRetry(jobId: string, maxRetries: number = 3, baseDelay: number = 500): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Buscar upload pelo jobId (pode estar em blackForestJobId ou em stageJobIds)
      let upload = await uploadRepository.findByBlackForestJobId(jobId);
      
      if (!upload) {
        // Tentar buscar por stage job ID
        upload = await uploadRepository.findByStageJobId(jobId);
      }
      
      if (upload) {
        if (attempt > 0) {
          logger.info(`Upload found for job ${jobId} on attempt ${attempt + 1}`);
        }
        return upload;
      }
      
      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        logger.debug(`Upload not found for job ${jobId}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  }

  private async processNextStage(upload: any, inputImageUrl: string, nextStage: any, stageIndex: number): Promise<void> {
    try {
      // Atualizar currentStage
      await uploadRepository.updateCurrentStage(upload.id, nextStage.stage);
      
      // Importar e instanciar o BlackForestProvider
      const { providerConfigManager } = await import('../config/provider.config');
      const blackForestConfig = providerConfigManager.getConfig('black-forest');
      
      if (!blackForestConfig) {
        throw new Error('Black Forest provider não configurado');
      }

      const { BlackForestProvider } = await import('../services/providers/black-forest.provider');
      const provider = new BlackForestProvider(blackForestConfig);
      
      // Converter URL da imagem para base64
      const imageBase64 = await provider.downloadAndConvertToBase64(inputImageUrl);
      
      // Executar a próxima etapa
      const result = await (provider as any).executeStage(
        upload.id,
        imageBase64,
        nextStage,
        upload.roomType,
        upload.furnitureStyle
      );
      
      if (result.success && result.jobId) {
        // Atualizar o stageJobIds com o novo jobId
        const updatedStageJobIds = {
          ...(upload.stageJobIds || {}),
          [nextStage.stage]: result.jobId
        };
        
        // Atualizar o stageJobIds
        await uploadRepository.updateStageJobIds(upload.id, updatedStageJobIds);
        
        logger.info(`Stage ${nextStage.stage} submitted for upload ${upload.id}`, { jobId: result.jobId });
      } else {
        throw new Error(`Falha ao enviar etapa ${nextStage.stage}`);
      }
      
    } catch (error) {
      logger.error(`Error processing next stage for upload ${upload.id}:`, error as Error);
      await uploadRepository.updateStatus(upload.id, 'failed');
    }
  }
}

export const webhookController = new WebhookController();
