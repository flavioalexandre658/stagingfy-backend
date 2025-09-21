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
          console.log('result', result);
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
      const rawPayload = JSON.stringify(req.body);
      console.log('[INFO] Black Forest webhook received - FULL PAYLOAD', {
        fullPayload: rawPayload,
        headers: req.headers
      });

      // Mapear task_id para jobId
      const webhookData = {
        jobId: req.body.task_id || req.body.id,
        status: req.body.status === 'SUCCESS' ? 'completed' : req.body.status,
        result: req.body.result,
        timestamp: new Date().toISOString()
      };

      console.log('[INFO] Black Forest webhook received', {
        jobId: webhookData.jobId,
        status: webhookData.status,
        originalStatus: req.body.status
      });

      if (!webhookData.jobId) {
        console.log('[WARN] No job ID found in webhook payload');
        res.status(400).json({ error: 'No job ID found' });
        return;
      }

      // Buscar upload pelo jobId (pode estar em blackForestJobId ou em stageJobIds)
      let upload = await uploadRepository.findByBlackForestJobId(webhookData.jobId);
      
      if (!upload) {
        // Tentar buscar por stage job ID
        upload = await uploadRepository.findByStageJobId(webhookData.jobId);
      }
      
      if (!upload) {
        console.log('[WARN] Upload not found for Black Forest job', { jobId: webhookData.jobId });
        res.status(404).json({ error: 'Upload not found' });
        return;
      }

      console.log('[INFO] Processing webhook for upload', { 
        uploadId: upload.id, 
        jobId: webhookData.jobId,
        status: webhookData.status,
        currentStage: upload.currentStage
      });

      // Se o job foi concluído com sucesso
      if (webhookData.status === 'completed' && webhookData.result?.sample) {
        const imageUrl = this.extractImageUrl(webhookData.result.sample);
        
        if (imageUrl && upload.currentStage && upload.stagingPlan) {
          console.log(`[${upload.id}] ✅ Etapa ${upload.currentStage} concluída. URL: ${imageUrl}`);
          
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
              console.log(`[${upload.id}] 🚀 Iniciando próxima etapa: ${nextStage.stage}`);
              await this.processNextStage(upload, imageUrl, nextStage, nextStageIndex);
            }
          } else {
            // Última etapa concluída - finalizar
            console.log(`[${upload.id}] 🎉 Todas as etapas concluídas!`);
            await uploadRepository.updateStatus(upload.id, 'completed');
            await uploadRepository.updateOutputImage(upload.id, imageUrl, undefined);
          }
        }
      } else if (webhookData.status === 'failed') {
        console.log(`[${upload.id}] ❌ Etapa ${upload.currentStage} falhou`);
        await uploadRepository.updateStatus(upload.id, 'failed');
      } else {
        // Status de processamento - apenas atualizar
        await uploadRepository.updateStatus(upload.id, webhookData.status);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[ERROR] Webhook processing failed:', error);
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

  private async processNextStage(upload: any, inputImageUrl: string, nextStage: any, stageIndex: number): Promise<void> {
    try {
      console.log(`[${upload.id}] 🚀 Processando próxima etapa: ${nextStage.stage}`);
      
      // Atualizar currentStage
      await uploadRepository.updateCurrentStage(upload.id, nextStage.stage);
      console.log(`[${upload.id}] ✅ Current stage atualizado para: ${nextStage.stage}`);
      
      // Importar e instanciar o BlackForestProvider
      const { providerConfigManager } = await import('../config/provider.config');
      const blackForestConfig = providerConfigManager.getConfig('black-forest');
      
      if (!blackForestConfig) {
        throw new Error('Black Forest provider não configurado');
      }

      const { BlackForestProvider } = await import('../services/providers/black-forest.provider');
      const provider = new BlackForestProvider(blackForestConfig);
      
      // Converter URL da imagem para base64
      console.log(`[${upload.id}] 🔄 Convertendo imagem de URL para base64...`);
      const imageBase64 = await provider.downloadAndConvertToBase64(inputImageUrl);
      console.log(`[${upload.id}] ✅ Imagem convertida para base64`);
      
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
        const updatedStageJobIds = [...(upload.stageJobIds || [])];
        updatedStageJobIds[stageIndex] = result.jobId;
        
        // Atualizar o stageJobIds
        await uploadRepository.updateStageJobIds(upload.id, updatedStageJobIds);
        
        console.log(`[${upload.id}] ✅ Etapa ${nextStage.stage} enviada. Job ID: ${result.jobId}`);
      } else {
        throw new Error(`Falha ao enviar etapa ${nextStage.stage}`);
      }
      
    } catch (error) {
      console.error(`[${upload.id}] ❌ Erro ao processar próxima etapa:`, error);
      await uploadRepository.updateStatus(upload.id, 'failed');
    }
  }
}

export const webhookController = new WebhookController();
